import {
  db,
  settings,
  users,
  categories,
  articles,
  agendas,
  announcements,
  teachers,
  studentsAlumni,
  pages,
  galleries,
  documents,
  heroSlides,
  extracurriculars,
  facilities,
  registrations,
  ppdbFormVersions,
  navigationItems,
  graduations,
  media,
  bkkOpportunities,
  mahadPrograms,
} from '../db';

export interface DatabaseSnapshot {
  version: '1.0';
  exportedAt: string;
  checksum: string;
  institution: string;
  metadata: {
    totalTables: number;
    tableCounts: Record<string, number>;
  };
  data: {
    settings: any[];
    users: any[];
    categories: any[];
    articles: any[];
    agendas: any[];
    announcements: any[];
    teachers: any[];
    studentsAlumni: any[];
    pages: any[];
    galleries: any[];
    documents: any[];
    heroSlides?: any[];
    extracurriculars?: any[];
    facilities?: any[];
    registrations?: any[];
    ppdbFormVersions?: any[];
    navigationItems?: any[];
    graduations?: any[];
    media?: any[];
    bkkOpportunities?: any[];
    mahadPrograms?: any[];
  };
}

/**
 * Calculate SHA-256 checksum string for data verification.
 */
async function computeSha256(content: string): Promise<string> {
  const encoder = new TextEncoder();
  const data = encoder.encode(content);
  const hashBuffer = await crypto.subtle.digest('SHA-256', data);
  return Array.from(new Uint8Array(hashBuffer))
    .map((b) => b.toString(16).padStart(2, '0'))
    .join('');
}

/**
 * Create a complete JSON snapshot of all school database tables.
 */
export async function createDatabaseSnapshot(): Promise<DatabaseSnapshot> {
  const [
    settingsRows,
    usersRows,
    categoriesRows,
    articlesRows,
    agendasRows,
    announcementsRows,
    teachersRows,
    studentsAlumniRows,
    pagesRows,
    galleriesRows,
    documentsRows,
    heroSlidesRows,
    extracurricularsRows,
    facilitiesRows,
    registrationsRows,
    ppdbFormVersionsRows,
    navigationItemsRows,
    graduationsRows,
    mediaRows,
    bkkOpportunitiesRows,
    mahadProgramsRows,
  ] = await Promise.all([
    db.select().from(settings),
    db.select().from(users),
    db.select().from(categories),
    db.select().from(articles),
    db.select().from(agendas),
    db.select().from(announcements),
    db.select().from(teachers),
    db.select().from(studentsAlumni),
    db.select().from(pages),
    db.select().from(galleries),
    db.select().from(documents),
    db.select().from(heroSlides),
    db.select().from(extracurriculars),
    db.select().from(facilities),
    db.select().from(registrations),
    db.select().from(ppdbFormVersions),
    db.select().from(navigationItems),
    db.select().from(graduations),
    db.select().from(media),
    db.select().from(bkkOpportunities),
    db.select().from(mahadPrograms),
  ]);

  const rawData = {
    settings: settingsRows,
    users: usersRows,
    categories: categoriesRows,
    articles: articlesRows,
    agendas: agendasRows,
    announcements: announcementsRows,
    teachers: teachersRows,
    studentsAlumni: studentsAlumniRows,
    pages: pagesRows,
    galleries: galleriesRows,
    documents: documentsRows,
    heroSlides: heroSlidesRows,
    extracurriculars: extracurricularsRows,
    facilities: facilitiesRows,
    registrations: registrationsRows,
    ppdbFormVersions: ppdbFormVersionsRows,
    navigationItems: navigationItemsRows,
    graduations: graduationsRows,
    media: mediaRows,
    bkkOpportunities: bkkOpportunitiesRows,
    mahadPrograms: mahadProgramsRows,
  };

  const serializedData = JSON.stringify(rawData);
  const checksum = await computeSha256(serializedData);

  const tableCounts = {
    settings: settingsRows.length,
    users: usersRows.length,
    categories: categoriesRows.length,
    articles: articlesRows.length,
    agendas: agendasRows.length,
    announcements: announcementsRows.length,
    teachers: teachersRows.length,
    studentsAlumni: studentsAlumniRows.length,
    pages: pagesRows.length,
    galleries: galleriesRows.length,
    documents: documentsRows.length,
    heroSlides: heroSlidesRows.length,
    extracurriculars: extracurricularsRows.length,
    facilities: facilitiesRows.length,
    registrations: registrationsRows.length,
    ppdbFormVersions: ppdbFormVersionsRows.length,
    navigationItems: navigationItemsRows.length,
    graduations: graduationsRows.length,
    media: mediaRows.length,
    bkkOpportunities: bkkOpportunitiesRows.length,
    mahadPrograms: mahadProgramsRows.length,
  };

  return {
    version: '1.0',
    exportedAt: new Date().toISOString(),
    checksum,
    institution: 'SMAN 1 Unggulan',
    metadata: {
      totalTables: Object.keys(tableCounts).length,
      tableCounts,
    },
    data: rawData,
  };
}

/**
 * Restore database tables from a verified snapshot.
 */
export async function restoreDatabaseSnapshot(
  snapshot: any
): Promise<{ success: boolean; restoredCounts: Record<string, number> }> {
  if (!snapshot || snapshot.version !== '1.0' || !snapshot.data || !snapshot.checksum) {
    throw new Error('Berkas snapshot tidak valid atau tidak memiliki format standar v1.0.');
  }

  // Verifikasi integritas checksum SHA-256
  const serializedData = JSON.stringify(snapshot.data);
  const actualChecksum = await computeSha256(serializedData);

  if (actualChecksum !== snapshot.checksum) {
    throw new Error('Integritas data rusak: Checksum SHA-256 tidak cocok. Berkas kemungkinan telah dimodifikasi atau korup.');
  }

  const { data } = snapshot;
  const restoredCounts: Record<string, number> = {};

  // 1. Settings
  if (Array.isArray(data.settings)) {
    for (const item of data.settings) {
      await db.insert(settings).values(item).onConflictDoUpdate({
        target: settings.key,
        set: { value: item.value, updatedAt: new Date().toISOString() },
      });
    }
    restoredCounts.settings = data.settings.length;
  }

  // 2. Users
  if (Array.isArray(data.users)) {
    for (const item of data.users) {
      await db.insert(users).values(item).onConflictDoUpdate({
        target: users.id,
        set: {
          name: item.name,
          role: item.role,
          isActive: item.isActive,
          passwordHash: item.passwordHash,
        },
      });
    }
    restoredCounts.users = data.users.length;
  }

  // 3. Categories
  if (Array.isArray(data.categories)) {
    for (const item of data.categories) {
      await db.insert(categories).values(item).onConflictDoUpdate({
        target: categories.id,
        set: { name: item.name, slug: item.slug },
      });
    }
    restoredCounts.categories = data.categories.length;
  }

  // 4. Articles
  if (Array.isArray(data.articles)) {
    for (const item of data.articles) {
      await db.insert(articles).values(item).onConflictDoUpdate({
        target: articles.id,
        set: {
          slug: item.slug,
          title: item.title,
          summary: item.summary,
          content: item.content,
          coverImage: item.coverImage,
          categoryId: item.categoryId,
          status: item.status,
          publishedAt: item.publishedAt,
          viewCount: item.viewCount,
          deletedAt: item.deletedAt,
          updatedAt: new Date().toISOString(),
        },
      });
    }
    restoredCounts.articles = data.articles.length;
  }

  // 5. Agendas
  if (Array.isArray(data.agendas)) {
    for (const item of data.agendas) {
      await db.insert(agendas).values(item).onConflictDoUpdate({
        target: agendas.id,
        set: {
          title: item.title,
          description: item.description,
          eventDate: item.eventDate,
          endDate: item.endDate,
          startTime: item.startTime,
          endTime: item.endTime,
          location: item.location,
          isCompleted: item.isCompleted,
          updatedAt: new Date().toISOString(),
        },
      });
    }
    restoredCounts.agendas = data.agendas.length;
  }

  // 6. Announcements
  if (Array.isArray(data.announcements)) {
    for (const item of data.announcements) {
      await db.insert(announcements).values(item).onConflictDoUpdate({
        target: announcements.id,
        set: {
          text: item.text,
          linkUrl: item.linkUrl,
          linkText: item.linkText,
          isActive: item.isActive,
          isUrgent: item.isUrgent,
          expiresAt: item.expiresAt,
        },
      });
    }
    restoredCounts.announcements = data.announcements.length;
  }

  // 7. Teachers
  if (Array.isArray(data.teachers)) {
    for (const item of data.teachers) {
      await db.insert(teachers).values(item).onConflictDoUpdate({
        target: teachers.id,
        set: {
          name: item.name,
          nip: item.nip,
          position: item.position,
          subject: item.subject,
          photoUrl: item.photoUrl,
          orderNumber: item.orderNumber,
          isActive: item.isActive,
        },
      });
    }
    restoredCounts.teachers = data.teachers.length;
  }

  // 8. Students Alumni
  if (Array.isArray(data.studentsAlumni)) {
    for (const item of data.studentsAlumni) {
      await db.insert(studentsAlumni).values(item).onConflictDoUpdate({
        target: studentsAlumni.id,
        set: {
          name: item.name,
          type: item.type,
          title: item.title,
          year: item.year,
          organization: item.organization,
          photoUrl: item.photoUrl,
          description: item.description,
          isPublicConsent: item.isPublicConsent,
        },
      });
    }
    restoredCounts.studentsAlumni = data.studentsAlumni.length;
  }

  // 9. Pages
  if (Array.isArray(data.pages)) {
    for (const item of data.pages) {
      await db.insert(pages).values(item).onConflictDoUpdate({
        target: pages.id,
        set: {
          slug: item.slug,
          title: item.title,
          content: item.content,
          metaTitle: item.metaTitle,
          metaDescription: item.metaDescription,
          isPublished: item.isPublished,
          updatedAt: new Date().toISOString(),
        },
      });
    }
    restoredCounts.pages = data.pages.length;
  }

  // 10. Galleries
  if (Array.isArray(data.galleries)) {
    for (const item of data.galleries) {
      await db.insert(galleries).values(item).onConflictDoUpdate({
        target: galleries.id,
        set: {
          title: item.title,
          type: item.type,
          mediaUrl: item.mediaUrl,
          caption: item.caption,
          albumName: item.albumName,
        },
      });
    }
    restoredCounts.galleries = data.galleries.length;
  }

  // 11. Documents
  if (Array.isArray(data.documents)) {
    for (const item of data.documents) {
      await db.insert(documents).values(item).onConflictDoUpdate({
        target: documents.id,
        set: {
          title: item.title,
          fileUrl: item.fileUrl,
          fileSize: item.fileSize,
          fileType: item.fileType,
          category: item.category,
          downloadCount: item.downloadCount,
        },
      });
    }
    restoredCounts.documents = data.documents.length;
  }

  // 12. Hero Slides
  if (Array.isArray(data.heroSlides)) {
    for (const item of data.heroSlides) {
      await db.insert(heroSlides).values(item).onConflictDoUpdate({
        target: heroSlides.id,
        set: {
          title: item.title,
          subtitle: item.subtitle,
          imageUrl: item.imageUrl,
          linkUrl: item.linkUrl,
          linkText: item.linkText,
          linkUrl2: item.linkUrl2,
          linkText2: item.linkText2,
          orderNumber: item.orderNumber,
          isActive: item.isActive,
        },
      });
    }
    restoredCounts.heroSlides = data.heroSlides.length;
  }

  // 13. Extracurriculars
  if (Array.isArray(data.extracurriculars)) {
    for (const item of data.extracurriculars) {
      await db.insert(extracurriculars).values(item).onConflictDoUpdate({
        target: extracurriculars.id,
        set: {
          name: item.name,
          category: item.category,
          schedule: item.schedule,
          coach: item.coach,
          description: item.description,
          imageUrl: item.imageUrl,
          orderNumber: item.orderNumber,
          isActive: item.isActive,
        },
      });
    }
    restoredCounts.extracurriculars = data.extracurriculars.length;
  }

  // 14. Facilities
  if (Array.isArray(data.facilities)) {
    for (const item of data.facilities) {
      await db.insert(facilities).values(item).onConflictDoUpdate({
        target: facilities.id,
        set: {
          name: item.name,
          category: item.category,
          location: item.location,
          capacity: item.capacity,
          description: item.description,
          imageUrl: item.imageUrl,
          orderNumber: item.orderNumber,
          isActive: item.isActive,
        },
      });
    }
    restoredCounts.facilities = data.facilities.length;
  }

  // 15. Registrations (PPDB)
  if (Array.isArray(data.registrations)) {
    for (const item of data.registrations) {
      await db.insert(registrations).values(item).onConflictDoUpdate({
        target: registrations.id,
        set: {
          fullName: item.fullName,
          nik: item.nik,
          status: item.status,
          verificationStatus: item.verificationStatus,
          selectionStatus: item.selectionStatus,
          updatedAt: new Date().toISOString(),
        },
      });
    }
    restoredCounts.registrations = data.registrations.length;
  }

  // 16. Navigation Items
  if (Array.isArray(data.navigationItems)) {
    for (const item of data.navigationItems) {
      await db.insert(navigationItems).values(item).onConflictDoUpdate({
        target: navigationItems.id,
        set: {
          label: item.label,
          type: item.type,
          href: item.href,
          parentId: item.parentId,
          sortOrder: item.sortOrder,
          isActive: item.isActive,
          showDesktop: item.showDesktop,
          showMobile: item.showMobile,
          openInNewTab: item.openInNewTab,
          updatedAt: new Date().toISOString(),
        },
      });
    }
    restoredCounts.navigationItems = data.navigationItems.length;
  }

  // 17. Graduations (Kelulusan / SKL)
  if (Array.isArray(data.graduations)) {
    for (const item of data.graduations) {
      await db.insert(graduations).values(item).onConflictDoUpdate({
        target: graduations.id,
        set: {
          academicYear: item.academicYear,
          nisn: item.nisn,
          nis: item.nis,
          name: item.name,
          className: item.className,
          major: item.major,
          gender: item.gender,
          birthPlace: item.birthPlace,
          birthDate: item.birthDate,
          status: item.status,
          letterNumber: item.letterNumber,
          averageScore: item.averageScore,
          notes: item.notes,
          updatedAt: new Date().toISOString(),
        },
      });
    }
    restoredCounts.graduations = data.graduations.length;
  }

  // 18. Media
  if (Array.isArray(data.media)) {
    for (const item of data.media) {
      await db.insert(media).values(item).onConflictDoUpdate({
        target: media.id,
        set: {
          fileName: item.fileName,
          originalName: item.originalName,
          fileUrl: item.fileUrl,
          thumbnailUrl: item.thumbnailUrl,
          mediumUrl: item.mediumUrl,
          fileSize: item.fileSize,
          fileType: item.fileType,
          fileExtension: item.fileExtension,
          category: item.category,
          title: item.title,
          description: item.description,
          altText: item.altText,
          updatedAt: new Date().toISOString(),
        },
      });
    }
    restoredCounts.media = data.media.length;
  }

  // 19. BKK & Kemitraan Industri (SMK)
  if (Array.isArray(data.bkkOpportunities)) {
    for (const item of data.bkkOpportunities) {
      await db.insert(bkkOpportunities).values(item).onConflictDoUpdate({
        target: bkkOpportunities.id,
        set: {
          title: item.title,
          companyName: item.companyName,
          companyLogo: item.companyLogo,
          type: item.type,
          location: item.location,
          salaryRange: item.salaryRange,
          deadline: item.deadline,
          quota: item.quota,
          requirements: item.requirements,
          contactPerson: item.contactPerson,
          orderNumber: item.orderNumber,
          isActive: item.isActive,
          updatedAt: new Date().toISOString(),
        },
      });
    }
    restoredCounts.bkkOpportunities = data.bkkOpportunities.length;
  }

  // 20. Ma'had & Kepesantrenan (Madrasah / Boarding)
  if (Array.isArray(data.mahadPrograms)) {
    for (const item of data.mahadPrograms) {
      await db.insert(mahadPrograms).values(item).onConflictDoUpdate({
        target: mahadPrograms.id,
        set: {
          name: item.name,
          category: item.category,
          target: item.target,
          schedule: item.schedule,
          mentor: item.mentor,
          description: item.description,
          imageUrl: item.imageUrl,
          orderNumber: item.orderNumber,
          isActive: item.isActive,
          updatedAt: new Date().toISOString(),
        },
      });
    }
    restoredCounts.mahadPrograms = data.mahadPrograms.length;
  }

  return { success: true, restoredCounts };
}
