import {redirect} from 'next/navigation';import {getSession} from '@/lib/auth';import AdminCRM from './AdminCRM';
export default async function AdminPage(){const s=await getSession();if(!s||s.role!=='admin')redirect('/login');return <AdminCRM/>}
