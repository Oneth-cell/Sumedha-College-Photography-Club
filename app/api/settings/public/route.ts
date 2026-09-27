import { NextResponse } from 'next/server';
import { getSettings } from '@/lib/data';

export async function GET() {
  try {
    const rows = await getSettings();

    return NextResponse.json(
      Object.fromEntries(
        rows.map((row) => [row.key, row.value])
      )
    );
  } catch (error) {
    console.error('Failed to load public settings:', error);

    return NextResponse.json(
      { error: 'Failed to load settings' },
      { status: 500 }
    );
  }
}