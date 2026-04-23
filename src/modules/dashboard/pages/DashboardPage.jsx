import { useCallback, useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { AppLoader } from '../../../shared/ui/AppLoader';
import { FormMessage } from '../../../shared/ui/FormMessage';
import { StatusPill } from '../../../shared/ui/StatusPill';
import { AcademicPageShell } from '../../academic/components/AcademicPageShell';
import { useAuth } from '../../auth/context/useAuth';
import { useCurrentSchool } from '../../schools/context/useCurrentSchool';
import { DashboardKpiGrid } from '../components/DashboardKpiGrid';
import { DashboardSectionCard } from '../components/DashboardSectionCard';
import {
  createEmptyDashboardModel,
  loadDashboardData,
} from '../helpers/dashboardAggregation';

function formatMetricValue(value) {
  if (typeof value === 'number') {
    return value.toLocaleString();
  }

  return value || '0';
}

function MetricList({ items = [] }) {
  if (items.length === 0) {
    return <p className="dashboard-empty-state">No metrics are available for this section yet.</p>;
  }

  return (
    <div className="dashboard-metric-list">
      {items.map((item) => (
        <div key={item.label} className="dashboard-metric-row">
          <div className="dashboard-metric-row__content">
            {item.href ? (
              <Link className="dashboard-inline-link" to={item.href}>
                {item.label}
              </Link>
            ) : (
              <p className="dashboard-metric-row__label">{item.label}</p>
            )}
            <strong className="dashboard-metric-row__value">{formatMetricValue(item.value)}</strong>
            {item.detail ? <p className="dashboard-metric-row__detail">{item.detail}</p> : null}
          </div>

          {item.href ? (
            <Link className="dashboard-inline-link" to={item.href}>
              Open
            </Link>
          ) : null}
        </div>
      ))}
    </div>
  );
}

function IssueGroup({ issues = [], title, tone }) {
  if (issues.length === 0) {
    return null;
  }

  return (
    <section className="dashboard-issue-group">
      <div className="academic-summary__grid">
        <StatusPill tone={tone}>{title}</StatusPill>
      </div>

      <ul className="dashboard-issue-list">
        {issues.slice(0, 4).map((issue) => (
          <li key={`${issue.code}-${issue.message}`}>
            <strong>{issue.code.replace(/_/g, ' ')}</strong>
            <span>{issue.message}</span>
          </li>
        ))}
      </ul>
    </section>
  );
}

function MessageList({ messages = [] }) {
  if (messages.length === 0) {
    return null;
  }

  return (
    <ul className="dashboard-note-list">
      {messages.map((message) => (
        <li key={message}>{message}</li>
      ))}
    </ul>
  );
}

export function DashboardPage() {
  const { profile } = useAuth();
  const { currentSchool, currentSchoolId } = useCurrentSchool();
  const schoolId = currentSchoolId || currentSchool.schoolId || '';
  const schoolName = currentSchool.name || '';
  const [dashboard, setDashboard] = useState(() =>
    createEmptyDashboardModel({
      profile,
      schoolId,
      schoolName,
    }),
  );
  const [status, setStatus] = useState('loading');
  const [error, setError] = useState('');

  const refreshDashboard = useCallback(async () => {
    setStatus('loading');
    setError('');

    try {
      const nextDashboard = await loadDashboardData({
        profile,
        schoolId,
        schoolName,
      });

      setDashboard(nextDashboard);
      setStatus('ready');
    } catch (loadError) {
      setDashboard(
        createEmptyDashboardModel({
          profile,
          schoolId,
          schoolName,
        }),
      );
      setStatus('error');
      setError(
        loadError instanceof Error ? loadError.message : 'Unable to load the dashboard.',
      );
    }
  }, [profile, schoolId, schoolName]);

  useEffect(() => {
    const timeoutId = window.setTimeout(() => {
      void refreshDashboard();
    }, 0);

    return () => {
      window.clearTimeout(timeoutId);
    };
  }, [refreshDashboard]);

  if (status === 'loading') {
    return <AppLoader label="Loading dashboard" />;
  }

  return (
    <AcademicPageShell
      eyebrow={dashboard.eyebrow}
      title={dashboard.title}
      description={dashboard.description}
      error={error}
      summary={
        <div className="academic-summary__grid">
          {dashboard.summaryPills.map((pill) => (
            <StatusPill key={pill.label} tone={pill.tone}>
              {pill.label}
            </StatusPill>
          ))}
        </div>
      }
    >
      <div className="dashboard-stack">
        {dashboard.notices.map((notice) => (
          <FormMessage key={notice.message} tone={notice.tone}>
            {notice.message}
          </FormMessage>
        ))}

        <DashboardKpiGrid items={dashboard.kpis} />

        <div className="dashboard-layout-grid">
          <DashboardSectionCard
            actionHref={dashboard.counts.actionHref}
            actionLabel={dashboard.counts.actionLabel}
            description={dashboard.counts.description}
            eyebrow={dashboard.counts.eyebrow}
            title={dashboard.counts.title}
          >
            <MetricList items={dashboard.counts.items} />
          </DashboardSectionCard>

          <DashboardSectionCard
            actionHref={dashboard.conflicts.actionHref}
            actionLabel={dashboard.conflicts.actionLabel}
            description={dashboard.conflicts.description}
            eyebrow={dashboard.conflicts.eyebrow}
            title={dashboard.conflicts.title}
          >
            <div className="dashboard-issue-stack">
              <div className="academic-summary__grid">
                <StatusPill
                  tone={dashboard.conflicts.errorCount > 0 ? 'error' : 'success'}
                >
                  Errors: {dashboard.conflicts.errorCount}
                </StatusPill>
                <StatusPill
                  tone={dashboard.conflicts.warningCount > 0 ? 'warning' : 'success'}
                >
                  Warnings: {dashboard.conflicts.warningCount}
                </StatusPill>
                <StatusPill tone="info">Info: {dashboard.conflicts.infoCount}</StatusPill>
              </div>

              <IssueGroup issues={dashboard.conflicts.error} title="Errors" tone="error" />
              <IssueGroup
                issues={dashboard.conflicts.warning}
                title="Warnings"
                tone="warning"
              />
              <IssueGroup issues={dashboard.conflicts.info} title="Info" tone="info" />
            </div>
          </DashboardSectionCard>

          <DashboardSectionCard
            actionHref={dashboard.plc.actionHref}
            actionLabel={dashboard.plc.actionLabel}
            description={dashboard.plc.description}
            eyebrow={dashboard.plc.eyebrow}
            title={dashboard.plc.title}
          >
            <MetricList items={dashboard.plc.items} />
            <MessageList messages={dashboard.plc.messages} />
          </DashboardSectionCard>

          <DashboardSectionCard
            actionHref={dashboard.substitutes.actionHref}
            actionLabel={dashboard.substitutes.actionLabel}
            description={dashboard.substitutes.description}
            eyebrow={dashboard.substitutes.eyebrow}
            title={dashboard.substitutes.title}
          >
            <MetricList items={dashboard.substitutes.items} />
            <MessageList messages={dashboard.substitutes.messages} />
          </DashboardSectionCard>
        </div>
      </div>
    </AcademicPageShell>
  );
}
