export function AuthShell({ children }) {
  return (
    <div className="auth-screen">
      <section className="auth-screen__intro">
        <div className="auth-screen__intro-panel">
          <p className="auth-screen__eyebrow">Timetable Pro</p>
          <h1 className="auth-screen__title">ระบบจัดตารางเรียนสำหรับโรงเรียนไทย</h1>
          <p className="auth-screen__copy">
            เข้าสู่ระบบครั้งเดียว แล้วใช้งานข้อมูลโรงเรียน ตารางสอน ภาระงานครู
            และเอกสารส่งออกได้อย่างปลอดภัย
          </p>

          <div className="auth-screen__highlights" aria-label="ความสามารถของระบบเข้าสู่ระบบ">
            <div>
              <span className="auth-screen__metric">Google</span>
              <p>ครูและผู้ดูแลระบบเข้าสู่ระบบได้รวดเร็วโดยไม่ต้องกรอก School ID</p>
            </div>
            <div>
              <span className="auth-screen__metric">อีเมล</span>
              <p>รองรับอีเมลและรหัสผ่านสำหรับบัญชีภายในโรงเรียน</p>
            </div>
            <div>
              <span className="auth-screen__metric">บทบาท</span>
              <p>แยกสิทธิ์ผู้ดูแลโรงเรียน ฝ่ายวิชาการ ครู และนักเรียน</p>
            </div>
          </div>
        </div>
      </section>

      <section className="auth-screen__form-area">{children}</section>
    </div>
  );
}
