import { redirect } from 'next/navigation';
import { headers } from 'next/headers';
import { getTranslations } from 'next-intl/server';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { auth } from '@/lib/auth';
import { getActiveSubscription } from '@/server/queries/subscriptions';
import { CancelReactivateButton } from '@/components/subscription/cancel-reactivate';
import { formatMoney } from '@/lib/money';
import { getSystemSettings } from '@/lib/settings';

export const metadata = { title: 'Subscription' };

export default async function SubscriptionPage() {
  const session = await auth.api.getSession({ headers: await headers() });
  if (!session) redirect('/sign-in');
  const [sub, system, t] = await Promise.all([
    getActiveSubscription(session.user.id),
    getSystemSettings(),
    getTranslations('subscription'),
  ]);

  return (
    <div className='flex max-w-2xl flex-col gap-8'>
      <header className='flex flex-col gap-2'>
        <p className='kicker'>Membership</p>
        <h1 className='font-heading text-3xl font-semibold tracking-tight'>{t('title')}</h1>
      </header>

      {sub ? (
        <div className='flex flex-col gap-4 rounded-xl border bg-card p-6'>
          <div className='flex items-center justify-between gap-3'>
            <div>
              <p className='font-heading text-xl font-semibold'>{sub.planName}</p>
              <p className='text-muted-foreground text-sm'>
                {formatMoney(sub.price, system)} / {sub.interval === 'month' ? t('monthly') : t('yearly')}
              </p>
            </div>
            {sub.status === 'active' ? (
              <Badge>Active</Badge>
            ) : (
              <Badge variant='outline'>{t('canceledUntil')}</Badge>
            )}
          </div>
          <p className='text-muted-foreground text-sm'>
            {sub.status === 'active'
              ? t('renews', { date: new Intl.DateTimeFormat('en', { dateStyle: 'long' }).format(sub.currentPeriodEnd) })
              : t('accessUntil', { date: new Intl.DateTimeFormat('en', { dateStyle: 'long' }).format(sub.currentPeriodEnd) })}
          </p>
          <div className='rule-dash' aria-hidden />
          <p className='text-muted-foreground text-sm'>{t('allAccess')}</p>
          <CancelReactivateButton planId={sub.planId} active={sub.status === 'active'} />
        </div>
      ) : (
        <div className='rounded-xl border-2 border-dashed p-10 text-center'>
          <p className='text-muted-foreground text-sm'>{t('none')}</p>
          <Button className='mt-4' render={<a href='/pricing' />}>{t('seePlans')}</Button>
        </div>
      )}
    </div>
  );
}
