import { GOOGLE_THEME_COLORS } from '../constants/themePalette';

const THEME_FIELDS = [
  {
    field: 'primaryColor',
    label: 'สีหลักของระบบ',
    helper: 'ใช้กับปุ่มหลัก ลิงก์ที่ active และจุดเน้นสำคัญ',
  },
  {
    field: 'successColor',
    label: 'สีสำเร็จ',
    helper: 'ใช้กับสถานะผ่าน สำเร็จ หรือพร้อมใช้งาน',
  },
  {
    field: 'warningColor',
    label: 'สีเตือน',
    helper: 'ใช้กับสถานะรอตรวจสอบหรือมีข้อมูลต้องระวัง',
  },
  {
    field: 'dangerColor',
    label: 'สีผิดพลาด',
    helper: 'ใช้กับข้อผิดพลาดและการแจ้งเตือนสำคัญ',
  },
];

export function ThemeColorPanel({ disabled = false, onChange, theme }) {
  return (
    <section className="theme-panel">
      <div className="theme-panel__header">
        <div>
          <p className="auth-card__eyebrow">ธีมสี</p>
          <h2 className="theme-panel__title">ปรับสีหน้าเว็บ</h2>
          <p className="theme-panel__copy">
            เลือกสีจากชุดสีหลักของระบบ โรงเรียนสามารถปรับโทนให้เหมาะกับการใช้งานประจำวันได้
          </p>
        </div>
      </div>

      <div className="theme-panel__grid">
        {THEME_FIELDS.map((themeField) => (
          <article key={themeField.field} className="theme-color-card">
            <div className="theme-color-card__header">
              <div>
                <h3>{themeField.label}</h3>
                <p>{themeField.helper}</p>
              </div>
              <span
                aria-hidden="true"
                className="theme-color-card__preview"
                style={{ background: theme[themeField.field] }}
              />
            </div>

            <div className="theme-color-card__swatches">
              {GOOGLE_THEME_COLORS.map((color) => {
                const isSelected = theme[themeField.field] === color.value;

                return (
                  <button
                    key={`${themeField.field}-${color.value}`}
                    type="button"
                    className={`theme-color-card__swatch${
                      isSelected ? ' theme-color-card__swatch--selected' : ''
                    }`}
                    disabled={disabled}
                    onClick={() => {
                      onChange(themeField.field, color.value);
                    }}
                  >
                    <span
                      aria-hidden="true"
                      className="theme-color-card__dot"
                      style={{ background: color.value }}
                    />
                    <span>{color.label}</span>
                  </button>
                );
              })}
            </div>
          </article>
        ))}
      </div>
    </section>
  );
}
