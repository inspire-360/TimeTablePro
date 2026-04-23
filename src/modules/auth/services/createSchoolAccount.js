import {
  deleteCurrentUserAccount,
  registerWithEmail,
  updateCurrentUserProfile,
} from '../api/authGateway';
import { createInitialSchoolRecords, resolveUserSession } from '../api/sessionRepository';

function buildCreationErrorMessage(error) {
  return error instanceof Error ? error.message : 'ไม่สามารถสร้างพื้นที่ของโรงเรียนได้';
}

export async function createSchoolAccount({
  academicYearLabel,
  adminName,
  email,
  password,
  positionTitle,
  province,
  schoolName,
  shortName,
}) {
  const userCredential = await registerWithEmail(email, password);

  try {
    await createInitialSchoolRecords({
      academicYearLabel,
      adminName,
      email,
      positionTitle,
      province,
      schoolName,
      shortName,
      uid: userCredential.user.uid,
    });

    await updateCurrentUserProfile({ displayName: adminName });

    const session = await resolveUserSession(userCredential.user.uid);

    if (!session) {
      throw new Error('ไม่สามารถยืนยันข้อมูลโรงเรียนหลังสร้างบัญชีได้');
    }

    return session;
  } catch (error) {
    try {
      await deleteCurrentUserAccount();
    } catch {
      // Ignore cleanup failure. The primary error is still the one we want to surface.
    }

    throw new Error(buildCreationErrorMessage(error));
  }
}
