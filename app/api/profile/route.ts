import { NextResponse } from 'next/server';
import { requireUser } from '@/lib/auth';
import { query } from '@/lib/postgres';
import { deleteFromR2 } from '@/lib/r2';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function POST(req: Request) {
  try {
    const s = await requireUser();

    const body = await req.json();

    const surname =
      String(body.surname || '').trim();

    const grade =
      String(body.grade || '').trim();

    const className =
      String(body.className || '').trim();

    const parentPhone =
      String(body.parentPhone || '').trim();

    const address =
      String(body.address || '').trim();

    const pfpKey =
      body.pfpKey
        ? String(body.pfpKey).trim()
        : '';

    if (
      !surname ||
      !grade ||
      !className ||
      !parentPhone ||
      !address
    ) {
      return NextResponse.json(
        {
          error:
            'All editable profile fields are required.',
        },
        {
          status: 400,
        }
      );
    }

    let pfpUrl: string | null = null;

    /* =====================================================
       PROFILE IMAGE
    ===================================================== */

    if (pfpKey) {
      const expectedPrefix =
        `profiles/${s.userId}/`;

      if (!pfpKey.startsWith(expectedPrefix)) {
        return NextResponse.json(
          {
            error:
              'Invalid profile image.',
          },
          {
            status: 403,
          }
        );
      }

      const publicBase =
        process.env.R2_PUBLIC_URL;

      if (!publicBase) {
        return NextResponse.json(
          {
            error:
              'R2 public URL is not configured.',
          },
          {
            status: 500,
          }
        );
      }

      pfpUrl =
        `${publicBase.replace(/\/$/, '')}/${pfpKey}`;
    }

    /* =====================================================
       GET EXISTING PROFILE
    ===================================================== */

    const existingResult =
      await query<{
        pfp_url: string | null;
      }>(
        `
        SELECT pfp_url
        FROM users
        WHERE id = $1
        LIMIT 1
        `,
        [s.userId]
      );

    const previousPfp =
      existingResult.rows[0]?.pfp_url ||
      null;

    /* =====================================================
       UPDATE USER
    ===================================================== */

    if (pfpUrl) {
      await query(
        `
        UPDATE users
        SET
          surname = $1,
          grade = $2,
          class_name = $3,
          parent_phone = $4,
          address = $5,
          pfp_url = $6,
          updated_at = CURRENT_TIMESTAMP
        WHERE id = $7
        `,
        [
          surname,
          grade,
          className,
          parentPhone,
          address,
          pfpUrl,
          s.userId,
        ]
      );
    } else {
      await query(
        `
        UPDATE users
        SET
          surname = $1,
          grade = $2,
          class_name = $3,
          parent_phone = $4,
          address = $5,
          updated_at = CURRENT_TIMESTAMP
        WHERE id = $6
        `,
        [
          surname,
          grade,
          className,
          parentPhone,
          address,
          s.userId,
        ]
      );
    }

    /* =====================================================
       REMOVE OLD R2 PROFILE IMAGE
    ===================================================== */

    if (
      pfpUrl &&
      previousPfp &&
      previousPfp !== pfpUrl
    ) {
      const publicBase =
        process.env.R2_PUBLIC_URL;

      if (
        publicBase &&
        previousPfp.startsWith(
          publicBase.replace(/\/$/, '') + '/'
        )
      ) {
        const oldKey =
          previousPfp.slice(
            `${publicBase.replace(/\/$/, '')}/`.length
          );

        if (
          oldKey.startsWith(
            `profiles/${s.userId}/`
          )
        ) {
          await deleteFromR2(
            oldKey
          ).catch(() => {});
        }
      }
    }

    return NextResponse.json({
      ok: true,
      pfpUrl:
        pfpUrl || previousPfp || null,
    });

  } catch (error: any) {
    console.error(
      '[PROFILE UPDATE ERROR]',
      error
    );

    return NextResponse.json(
      {
        error:
          error?.message ||
          'Profile update failed.',
      },
      {
        status: 500,
      }
    );
  }
}