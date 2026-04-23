import {
  buildTimetableCellSubtitle,
  getTimetableCellEmptyLabel,
} from '../services/timetableExportService';

function buildSupportSlotLabel(slot) {
  return slot.slotType === 'lunch' ? 'Lunch' : 'Break';
}

function SignatureBlock({ signature }) {
  return (
    <div className="export-signature-card">
      {signature.imageUrl ? (
        <img
          alt={signature.name || 'Signature'}
          className="export-signature-card__image"
          crossOrigin="anonymous"
          src={signature.imageUrl}
        />
      ) : (
        <div className="export-signature-card__placeholder" />
      )}

      <div className="export-signature-card__line" />
      <strong>{signature.name || 'Signature'}</strong>
      <span>{signature.title || 'Title not set'}</span>
    </div>
  );
}

export function TimetableExportPreview({ documentData, previewRef }) {
  return (
    <div className="export-preview-shell">
      <div ref={previewRef} className="export-document">
        <header className="export-document__header">
          <div className="export-document__branding">
            {documentData.school.logoUrl ? (
              <img
                alt={`${documentData.school.name} logo`}
                className="export-document__logo"
                crossOrigin="anonymous"
                src={documentData.school.logoUrl}
              />
            ) : (
              <div className="export-document__logo export-document__logo--placeholder">
                {documentData.school.name?.slice(0, 2).toUpperCase() || 'SC'}
              </div>
            )}

            <div className="export-document__heading">
              <p className="export-document__eyebrow">{documentData.documentLabel}</p>
              <h2>{documentData.school.name}</h2>
              {documentData.school.affiliation ? (
                <p>{documentData.school.affiliation}</p>
              ) : null}
            </div>
          </div>

          <div className="export-document__meta">
            <p>{documentData.documentTitle}</p>
            <strong>{documentData.owner.label}</strong>
            <span>{documentData.publicationLabel}</span>
            {documentData.publicationTimestampLabel ? (
              <span>Published at {documentData.publicationTimestampLabel}</span>
            ) : null}
            <span>{documentData.academicYear?.label || 'Academic year not set'}</span>
            <span>{documentData.term.name || 'Term not set'}</span>
            <span>{documentData.timeStructure.name || 'Time structure not set'}</span>
            <span>Exported at {documentData.createdAtLabel}</span>
          </div>
        </header>

        <section className="export-document__table-shell">
          <table className="export-document__table">
            <thead>
              <tr>
                <th>Slot</th>
                {documentData.weekdays.map((weekday) => (
                  <th key={weekday.key}>{weekday.label}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {documentData.slotRows.map((slotIndex) => (
                <tr key={slotIndex}>
                  <th className="export-document__row-label">
                    <strong>Slot {slotIndex}</strong>
                    <span>
                      {documentData.weekdays
                        .map(
                          (weekday) =>
                            (documentData.timeSlotsByWeekday.get(weekday.key) || [])[slotIndex - 1],
                        )
                        .find(Boolean)?.startTime || ''}
                      {' - '}
                      {documentData.weekdays
                        .map(
                          (weekday) =>
                            (documentData.timeSlotsByWeekday.get(weekday.key) || [])[slotIndex - 1],
                        )
                        .find(Boolean)?.endTime || ''}
                    </span>
                  </th>

                  {documentData.weekdays.map((weekday) => {
                    const slot =
                      (documentData.timeSlotsByWeekday.get(weekday.key) || [])[slotIndex - 1] ||
                      null;
                    const cellEntries = slot
                      ? documentData.entriesByTimeSlot.get(slot.id) || []
                      : [];

                    if (!slot) {
                      return (
                        <td key={`${weekday.key}-${slotIndex}`}>
                          <div className="export-document__cell export-document__cell--missing">
                            No slot
                          </div>
                        </td>
                      );
                    }

                    return (
                      <td key={slot.id}>
                        <div
                          className={`export-document__cell${
                            slot.slotType !== 'teaching'
                              ? ' export-document__cell--support'
                              : ''
                          }`}
                        >
                          <div className="export-document__cell-head">
                            <strong>
                              {slot.startTime} - {slot.endTime}
                            </strong>
                            <span>{slot.slotType}</span>
                          </div>

                          {cellEntries.length === 0 ? (
                            <div className="export-document__empty">
                              {slot.slotType === 'teaching'
                                ? getTimetableCellEmptyLabel(documentData.documentType)
                                : buildSupportSlotLabel(slot)}
                            </div>
                          ) : (
                            <div className="export-document__entries">
                              {cellEntries.map((entry) => (
                                <article key={entry.id} className="export-document__entry">
                                  <strong>{entry.subjectShortName || entry.subjectName}</strong>
                                  <span>
                                    {buildTimetableCellSubtitle(
                                      entry,
                                      documentData.documentType,
                                    )}
                                  </span>
                                </article>
                              ))}
                            </div>
                          )}
                        </div>
                      </td>
                    );
                  })}
                </tr>
              ))}
            </tbody>
          </table>
        </section>

        {documentData.schoolSettings.signatures.length > 0 ? (
          <footer className="export-document__footer">
            <p className="export-document__footer-title">Authorized Signatures</p>
            <div className="export-signature-grid">
              {documentData.schoolSettings.signatures.map((signature) => (
                <SignatureBlock key={signature.id} signature={signature} />
              ))}
            </div>
          </footer>
        ) : null}
      </div>
    </div>
  );
}
