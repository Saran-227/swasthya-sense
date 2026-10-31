import React, { useState } from 'react';
import { usePortalStore } from '../../store/usePortalStore';
import type { ReminderRecord } from '../../types/portal';
import {
  History,
  Send,
  CheckCircle2,
  AlertCircle,
  Clock,
  Radio,
  Play,
  RefreshCw,
  Info,
} from 'lucide-react';

export const ReminderTimeline: React.FC = () => {
  const { currentPatient, reminders, refreshReminders, triggerTestReminder } = usePortalStore();
  const [isSendingTest, setIsSendingTest] = useState(false);
  const [testResult, setTestResult] = useState<string | null>(null);

  const handleSendTest = async (type: string = 'Upcoming') => {
    if (!currentPatient) return;
    setIsSendingTest(true);
    setTestResult(null);
    try {
      const res = await triggerTestReminder(type, false);
      setTestResult(`Test reminder triggered successfully (${res.result?.delivery_status || 'Delivered'})`);
      setTimeout(() => setTestResult(null), 4000);
    } catch (err: any) {
      setTestResult(`Error: ${err.message}`);
    } finally {
      setIsSendingTest(false);
    }
  };

  const getStatusBadge = (status: ReminderRecord['delivery_status']) => {
    switch (status) {
      case 'Sent':
        return (
          <span
            className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-[10px] font-medium"
            style={{ backgroundColor: 'rgba(46, 139, 87, 0.12)', color: 'var(--low)', border: '1px solid var(--low)' }}
          >
            <CheckCircle2 size={11} />
            <span>Sent</span>
          </span>
        );
      case 'Simulated':
        return (
          <span
            className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-[10px] font-medium font-mono"
            style={{ backgroundColor: 'var(--hov)', color: 'var(--acc)', border: '1px solid var(--bd)' }}
          >
            <Radio size={11} />
            <span>Simulated</span>
          </span>
        );
      case 'Failed':
        return (
          <span
            className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-[10px] font-medium"
            style={{ backgroundColor: 'rgba(200, 29, 58, 0.12)', color: 'var(--high)', border: '1px solid var(--high)' }}
          >
            <AlertCircle size={11} />
            <span>Failed</span>
          </span>
        );
      default:
        return (
          <span
            className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-[10px] font-medium"
            style={{ backgroundColor: 'var(--hov)', color: 'var(--mut)', border: '1px solid var(--bd)' }}
          >
            <Clock size={11} />
            <span>Pending</span>
          </span>
        );
    }
  };

  return (
    <div className="space-y-4">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 pb-2 border-b" style={{ borderColor: 'var(--bd)' }}>
        <div>
          <h4 className="text-sm font-semibold flex items-center gap-2" style={{ color: 'var(--ink)' }}>
            <History size={16} style={{ color: 'var(--acc)' }} />
            <span>Reminder Delivery Audit History</span>
          </h4>
          <p className="text-xs mt-0.5" style={{ color: 'var(--mut)' }}>
            Historical record of automated follow-up reminders sent to this patient.
          </p>
        </div>

        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={() => refreshReminders()}
            className="p-1.5 rounded border text-muted hover:text-ink transition-colors"
            style={{ borderColor: 'var(--bd)', color: 'var(--mut)' }}
            title="Refresh History"
            aria-label="Refresh reminder history"
          >
            <RefreshCw size={13} />
          </button>
          <button
            type="button"
            disabled={isSendingTest || !currentPatient?.telegram_linked}
            onClick={() => handleSendTest('Upcoming')}
            className="px-3 py-1.5 rounded text-xs font-medium flex items-center gap-1.5 disabled:opacity-40 disabled:cursor-not-allowed transition-all"
            style={{
              backgroundColor: 'var(--acc)',
              color: 'var(--onacc)',
            }}
            title={!currentPatient?.telegram_linked ? 'Connect Telegram to test reminder delivery' : 'Trigger instant test reminder'}
          >
            {isSendingTest ? (
              <RefreshCw size={12} className="animate-spin" />
            ) : (
              <Send size={12} />
            )}
            <span>Send Test Reminder</span>
          </button>
        </div>
      </div>

      {testResult && (
        <div
          className="p-2.5 rounded text-xs flex items-center gap-2 border animate-fade-in"
          style={{
            backgroundColor: 'var(--hov)',
            borderColor: testResult.startsWith('Error') ? 'var(--high)' : 'var(--low)',
            color: testResult.startsWith('Error') ? 'var(--high)' : 'var(--low)',
          }}
        >
          <Info size={14} />
          <span>{testResult}</span>
        </div>
      )}

      {reminders.length === 0 ? (
        <div
          className="p-8 text-center rounded border space-y-2"
          style={{ backgroundColor: 'var(--hov)', borderColor: 'var(--bd)' }}
        >
          <History size={28} className="mx-auto" style={{ color: 'var(--mut)' }} />
          <div className="text-xs font-semibold" style={{ color: 'var(--ink)' }}>
            No Reminders Dispatched Yet
          </div>
          <div className="text-[11px] max-w-sm mx-auto" style={{ color: 'var(--mut)' }}>
            Reminders will appear here when scheduled follow-up dates arrive or when you trigger an on-demand test.
          </div>
        </div>
      ) : (
        <div className="overflow-x-auto rounded border" style={{ borderColor: 'var(--bd)' }}>
          <table className="w-full text-left text-xs border-collapse">
            <thead>
              <tr
                className="border-b font-mono uppercase text-[10px]"
                style={{ backgroundColor: 'var(--hov)', borderColor: 'var(--bd)', color: 'var(--mut)' }}
              >
                <th className="py-2.5 px-3">Date & Time</th>
                <th className="py-2.5 px-3">Type</th>
                <th className="py-2.5 px-3">Channel</th>
                <th className="py-2.5 px-3">Status</th>
                <th className="py-2.5 px-3">Message Summary</th>
              </tr>
            </thead>
            <tbody className="divide-y" style={{ borderColor: 'var(--bd)' }}>
              {reminders.map((r) => {
                const dateStr = r.sent_at || r.scheduled_at || r.created_at;
                const formattedDate = new Date(dateStr).toLocaleString(undefined, {
                  month: 'short',
                  day: 'numeric',
                  year: 'numeric',
                  hour: '2-digit',
                  minute: '2-digit',
                });

                return (
                  <tr
                    key={r.reminder_id}
                    className="hover:bg-hover transition-colors"
                    style={{ backgroundColor: 'var(--panel)', color: 'var(--ink)' }}
                  >
                    <td className="py-2.5 px-3 font-mono whitespace-nowrap text-[11px]">
                      {formattedDate}
                    </td>
                    <td className="py-2.5 px-3 font-medium">
                      <span
                        className="px-1.5 py-0.5 rounded text-[10px]"
                        style={{
                          backgroundColor:
                            r.reminder_type === 'Overdue'
                              ? 'rgba(200, 29, 58, 0.08)'
                              : r.reminder_type === 'Due Today'
                              ? 'rgba(184, 119, 0, 0.08)'
                              : 'var(--hov)',
                          color:
                            r.reminder_type === 'Overdue'
                              ? 'var(--high)'
                              : r.reminder_type === 'Due Today'
                              ? 'var(--mod)'
                              : 'var(--acc)',
                        }}
                      >
                        {r.reminder_type}
                      </span>
                    </td>
                    <td className="py-2.5 px-3 whitespace-nowrap flex items-center gap-1.5">
                      <Send size={12} style={{ color: 'var(--acc)' }} />
                      <span>{r.channel}</span>
                    </td>
                    <td className="py-2.5 px-3 whitespace-nowrap">
                      {getStatusBadge(r.delivery_status)}
                    </td>
                    <td className="py-2.5 px-3 max-w-xs truncate" style={{ color: 'var(--mut)' }} title={r.message_summary}>
                      {r.message_summary}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
};
