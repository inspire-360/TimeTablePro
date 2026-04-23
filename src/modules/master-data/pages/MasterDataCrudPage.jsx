import { useCallback, useEffect, useMemo, useState } from 'react';
import { AppLoader } from '../../../shared/ui/AppLoader';
import { StatusPill } from '../../../shared/ui/StatusPill';
import { useCurrentSchool } from '../../schools/context/useCurrentSchool';
import {
  deleteMasterDataRecord,
  listMasterDataRecords,
  saveMasterDataRecord,
} from '../api/masterDataRepository';
import { MasterDataFormCard } from '../components/MasterDataFormCard';
import { MasterDataPageShell } from '../components/MasterDataPageShell';
import { MasterDataRecordList } from '../components/MasterDataRecordList';
import { getMasterDataConfig } from '../config/masterDataConfigs';

async function loadDependencies(entityConfig, schoolId) {
  const dependencyEntityKeys = entityConfig.dependencies || [];
  const dependencyRecords = await Promise.all(
    dependencyEntityKeys.map((entityKey) => {
      const dependencyConfig = getMasterDataConfig(entityKey);

      return listMasterDataRecords({
        collectionName: dependencyConfig.collectionName,
        schoolId,
      });
    }),
  );

  return Object.fromEntries(
    dependencyEntityKeys.map((entityKey, index) => [entityKey, dependencyRecords[index]]),
  );
}

export function MasterDataCrudPage({ entityKey }) {
  const config = getMasterDataConfig(entityKey);
  const { currentSchool, currentSchoolId } = useCurrentSchool();
  const schoolId = currentSchoolId || currentSchool.schoolId || '';
  const [records, setRecords] = useState([]);
  const [dependencies, setDependencies] = useState({});
  const [selectedRecordId, setSelectedRecordId] = useState('');
  const [status, setStatus] = useState('loading');
  const [error, setError] = useState('');

  const selectedRecord = useMemo(
    () => records.find((record) => record.id === selectedRecordId) || null,
    [records, selectedRecordId],
  );

  const refreshRecords = useCallback(async () => {
    if (!config) {
      setStatus('error');
      setError('Master data configuration could not be found.');
      return;
    }

    if (!schoolId) {
      setRecords([]);
      setDependencies({});
      setSelectedRecordId('');
      setStatus('ready');
      return;
    }

    setStatus('loading');
    setError('');

    try {
      const [nextRecords, nextDependencies] = await Promise.all([
        listMasterDataRecords({
          collectionName: config.collectionName,
          schoolId,
        }),
        loadDependencies(config, schoolId),
      ]);

      setRecords(nextRecords);
      setDependencies(nextDependencies);
      setSelectedRecordId((current) => {
        if (current && nextRecords.some((record) => record.id === current)) {
          return current;
        }

        return nextRecords[0]?.id || '';
      });
      setStatus('ready');
    } catch (loadError) {
      setStatus('error');
      setError(
        loadError instanceof Error
          ? loadError.message
          : `Unable to load ${config.navLabel.toLowerCase()}.`,
      );
    }
  }, [config, schoolId]);

  useEffect(() => {
    const timeoutId = window.setTimeout(() => {
      void refreshRecords();
    }, 0);

    return () => {
      window.clearTimeout(timeoutId);
    };
  }, [refreshRecords]);

  async function handleSaveRecord(form) {
    if (!config) {
      throw new Error('Master data configuration could not be found.');
    }

    const payload = config.toPayload({
      dependencies,
      form,
      schoolId,
    });
    const savedRecord = await saveMasterDataRecord({
      collectionName: config.collectionName,
      id: form.id,
      payload,
    });

    await refreshRecords();
    setSelectedRecordId(savedRecord.id);

    return `${config.singularLabel} saved successfully.`;
  }

  async function handleDeleteRecord(record) {
    if (!config) {
      throw new Error('Master data configuration could not be found.');
    }

    await deleteMasterDataRecord({
      collectionName: config.collectionName,
      id: record.id,
    });
    await refreshRecords();

    return `${config.singularLabel} deleted successfully.`;
  }

  if (!config) {
    return <AppLoader label="Preparing master data module" />;
  }

  if (status === 'loading') {
    return <AppLoader label={`Loading ${config.navLabel.toLowerCase()}`} />;
  }

  const summaryBadges = config.buildSummaryBadges({
    dependencies,
    records,
  });

  return (
    <MasterDataPageShell
      title={config.title}
      description={config.description}
      error={error}
      summary={
        <div className="academic-summary__grid">
          {summaryBadges.map((badge) => (
            <StatusPill key={`${config.entityKey}-${badge.label}`} tone={badge.tone}>
              {badge.label}
            </StatusPill>
          ))}
        </div>
      }
    >
      <div className="academic-page-grid">
        <MasterDataFormCard
          key={`${selectedRecord?.id || 'new'}:${schoolId}:${Object.keys(dependencies).length}`}
          config={config}
          dependencies={dependencies}
          schoolId={schoolId}
          selectedRecord={selectedRecord}
          onSave={handleSaveRecord}
        />

        <MasterDataRecordList
          config={config}
          dependencies={dependencies}
          onDeleteRecord={handleDeleteRecord}
          onSelectNew={() => setSelectedRecordId('')}
          onSelectRecord={setSelectedRecordId}
          records={records}
          selectedRecordId={selectedRecordId}
        />
      </div>
    </MasterDataPageShell>
  );
}
