import { PrismaClient } from '@prisma/client';
import bcrypt from 'bcryptjs';

const prisma = new PrismaClient();

async function main() {
  // Create default admin
  const email = 'admin@euroauto.ro';
  const password = 'admin123';
  const hash = await bcrypt.hash(password, 10);

  const admin = await prisma.app_users.upsert({
    where: { email },
    update: {},
    create: {
      email,
      name: 'Admin',
      role: 'admin',
      password_hash: hash,
      active: true,
    },
  });

  console.log('Admin user:', admin.email, '(password: admin123)');

  // Create reception user
  const reception = await prisma.app_users.upsert({
    where: { email: 'receptie@euroauto.ro' },
    update: {},
    create: {
      email: 'receptie@euroauto.ro',
      name: 'Recepție',
      role: 'receptie',
      password_hash: await bcrypt.hash('receptie123', 10),
      active: true,
    },
  });

  console.log('Reception user:', reception.email, '(password: receptie123)');

  // Create inspector ITP user
  const inspector = await prisma.app_users.upsert({
    where: { email: 'inspector@euroauto.ro' },
    update: {},
    create: {
      email: 'inspector@euroauto.ro',
      name: 'Inspector ITP',
      role: 'inspector_itp',
      password_hash: await bcrypt.hash('inspector123', 10),
      active: true,
    },
  });

  console.log('Inspector user:', inspector.email, '(password: inspector123)');

  // Create chief of service user
  const chief = await prisma.app_users.upsert({
    where: { email: 'sefservice@euroauto.ro' },
    update: {},
    create: {
      email: 'sefservice@euroauto.ro',
      name: 'Șef Service',
      role: 'sef_service',
      password_hash: await bcrypt.hash('sef123', 10),
      active: true,
    },
  });

  console.log('Chief user:', chief.email, '(password: sef123)');

  // Create default Google conversion settings
  await prisma.dashboard_settings.upsert({
    where: { key: 'google_conversions' },
    update: {},
    create: {
      key: 'google_conversions',
      value: {
        enabled: true,
        validateOnly: true,
        defaultCurrency: 'RON',
        rules: {
          lead_confirmed_by_reception: {
            enabled: true,
            conversionActionId: 'REPLACE_WITH_GOOGLE_ADS_CONVERSION_ACTION_ID',
            defaultValue: 50,
            primary: true,
          },
          appointment_booked: {
            enabled: true,
            conversionActionId: 'REPLACE_WITH_GOOGLE_ADS_CONVERSION_ACTION_ID',
            defaultValue: 100,
            primary: false,
          },
          itp_done: {
            enabled: true,
            conversionActionId: 'REPLACE_WITH_GOOGLE_ADS_CONVERSION_ACTION_ID',
            defaultValue: 150,
            primary: false,
          },
          work_completed: {
            enabled: true,
            conversionActionId: 'REPLACE_WITH_GOOGLE_ADS_CONVERSION_ACTION_ID',
            defaultValue: 300,
            primary: false,
          },
        },
      },
    },
  });

  console.log('Dashboard settings seeded');
}

main()
  .catch(console.error)
  .finally(() => prisma.$disconnect());
