package com.qayem.hr.seeder;

import org.springframework.boot.ApplicationArguments;
import org.springframework.boot.ApplicationRunner;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.stereotype.Component;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.core.annotation.Order;
import org.springframework.transaction.annotation.Transactional;
import com.qayem.hr.entity.*;
import com.qayem.hr.repository.*;

import java.util.List;

@Component
@Order(0)
public class DbSeeder implements ApplicationRunner {
    @Value("${app.bootstrap-admin-password:}")
    private String bootstrapPassword;


    private final RoleRepository roleRepo;
    private final UserRepository userRepo;
    private final UserRoleRepository userRoleRepo;
    private final QuestionRepository questionRepo;
    private final SystemSettingRepository settingRepo;
    private final ReferenceListRepository refListRepo;
    private final PasswordEncoder passwordEncoder;

    public DbSeeder(RoleRepository roleRepo, UserRepository userRepo, UserRoleRepository userRoleRepo,
                    QuestionRepository questionRepo, SystemSettingRepository settingRepo,
                    ReferenceListRepository refListRepo, PasswordEncoder passwordEncoder) {
        this.roleRepo = roleRepo;
        this.userRepo = userRepo;
        this.userRoleRepo = userRoleRepo;
        this.questionRepo = questionRepo;
        this.settingRepo = settingRepo;
        this.refListRepo = refListRepo;
        this.passwordEncoder = passwordEncoder;
    }

    @Override
    @Transactional
    public void run(ApplicationArguments args) {
        seedRoles();
        seedAdminUser();
        seedQuestions();
        seedSystemSettings();
        seedReferenceLists();
    }

    private void seedRoles() {
        if (roleRepo.count() > 0) return;

        Role admin = Role.create("Admin", "مدير النظام",
                "Full access to all system features");
        Role manager = Role.create("Manager", "مدير",
                "View reports, issue decisions, override evaluations");
        Role evaluator = Role.create("Evaluator", "مقيّم",
                "Evaluate assigned candidates");
        Role dataEntry = Role.create("DataEntry", "مدخل بيانات",
                "Register candidates and manage sessions");

        List<Role> roles = roleRepo.saveAll(List.of(admin, manager, evaluator, dataEntry));

        // Add permissions to Admin role
        Role adminRole = roles.get(0);
        List<String> adminPerms = List.of("users:manage", "sessions:manage", "candidates:manage",
                "evaluations:view_all", "reports:view", "settings:manage", "questions:manage");
        adminPerms.forEach(p -> adminRole.getPermissions().add(RolePermission.create(adminRole, p)));

        // Manager permissions
        Role managerRole = roles.get(1);
        List<String> managerPerms = List.of("sessions:view", "candidates:view", "evaluations:view_all",
                "reports:view", "decisions:issue");
        managerPerms.forEach(p -> managerRole.getPermissions().add(RolePermission.create(managerRole, p)));

        // Evaluator permissions
        Role evaluatorRole = roles.get(2);
        List<String> evaluatorPerms = List.of("evaluations:submit", "candidates:view_assigned",
                "sessions:view_assigned");
        evaluatorPerms.forEach(p -> evaluatorRole.getPermissions().add(RolePermission.create(evaluatorRole, p)));

        // DataEntry permissions
        Role dataEntryRole = roles.get(3);
        List<String> dePerms = List.of("candidates:manage", "sessions:manage", "evaluations:view");
        dePerms.forEach(p -> dataEntryRole.getPermissions().add(RolePermission.create(dataEntryRole, p)));

        roleRepo.saveAll(roles);
    }

    private void seedAdminUser() {
        if (userRepo.count() > 0 || bootstrapPassword.isBlank()) return;
        if (bootstrapPassword.length() < 12 || bootstrapPassword.length() > 72)
            throw new IllegalArgumentException("Bootstrap password must have 12 to 72 characters.");

        Role adminRole = roleRepo.findByName("Admin").orElseThrow();
        String hash = passwordEncoder.encode(bootstrapPassword);

        User admin = User.create(
                "مدير النظام", "System Admin",
                "admin@example.invalid", "admin",
                hash, adminRole.getId(), null,
                "تقنية المعلومات", "مدير النظام", null);
        userRepo.save(admin);

        userRoleRepo.save(UserRole.createPrimary(admin.getId(), adminRole.getId(), null));
    }

    private void seedQuestions() {
        if (questionRepo.count() > 0) return;

        List<Question> questions = List.of(
            Question.create("المهارات التقنية والمعرفة المتخصصة", "Technical Skills & Specialized Knowledge", 1, "Technical", 5),
            Question.create("مهارات التواصل والتعبير", "Communication & Expression Skills", 2, "Communication", 5),
            Question.create("القدرة على حل المشكلات واتخاذ القرار", "Problem Solving & Decision Making", 3, "Analytical", 5),
            Question.create("العمل ضمن الفريق والقدرة على التعاون", "Teamwork & Collaboration", 4, "Interpersonal", 5),
            Question.create("الالتزام بالمهنية وأخلاقيات العمل", "Professionalism & Work Ethics", 5, "Behavioral", 5),
            Question.create("الملاءمة للمسمى الوظيفي والتطلعات المهنية", "Job Fit & Career Aspirations", 6, "Fit", 5)
        );
        questionRepo.saveAll(questions);
    }

    private void seedSystemSettings() {
        if (settingRepo.count() > 0) return;

        List<SystemSetting> settings = List.of(
            SystemSetting.create("Threshold_NotQualified", "17",
                "Maximum score to be classified as Not Qualified",
                "الحد الأقصى للدرجة لتصنيف غير مؤهل", "decimal"),
            SystemSetting.create("Threshold_Conditional", "23",
                "Maximum score to be classified as Conditionally Qualified",
                "الحد الأقصى للدرجة لتصنيف مؤهل مشروط", "decimal"),
            SystemSetting.create("Threshold_Discrepancy", "5",
                "Score variance threshold to flag discrepancy",
                "حد تباين الدرجات للإشارة إلى التضارب", "decimal"),
            SystemSetting.create("Max_Questions", "6",
                "Maximum number of evaluation questions",
                "الحد الأقصى لعدد أسئلة التقييم", "integer"),
            SystemSetting.create("System_Name_Ar", "قيّم",
                "Arabic system name", "اسم النظام بالعربية", "string"),
            SystemSetting.create("System_Name_En", "Qayem",
                "English system name", "اسم النظام بالإنجليزية", "string")
        );
        settingRepo.saveAll(settings);
    }

    private void seedReferenceLists() {
        seedList("GeneralDepartment", "الإدارة العامة", "General department", List.of());
        seedList("Agency", "الجهة", "Agency", List.of());

        seedList("Qualification", "المؤهل الدراسي", "Academic Qualification",
            List.of(
                new String[]{"ثانوية", "Secondary"},
                new String[]{"دبلوم", "Diploma"},
                new String[]{"بكالوريوس", "Bachelor"},
                new String[]{"ماجستير", "Master"},
                new String[]{"دكتوراه", "PhD"}
            ));

        seedList("ApplicationType", "نوع الطلب", "Application Type",
            List.of(
                new String[]{"وظيفة", "Employment"},
                new String[]{"تمهير", "Tamheer"},
                new String[]{"تدريب تعاوني", "Co-op Training"}
            ));

        seedList("GPASystem", "نظام المعدل", "GPA System",
            List.of(
                new String[]{"4.0", "4.0"},
                new String[]{"5.0", "5.0"},
                new String[]{"نسبة مئوية", "Percentage"}
            ));

        seedList("Department", "الإدارة", "Department",
            List.of(
                new String[]{"الموارد البشرية", "Human Resources"},
                new String[]{"تقنية المعلومات", "Information Technology"},
                new String[]{"الشؤون المالية", "Finance"},
                new String[]{"الشؤون القانونية", "Legal Affairs"},
                new String[]{"العلاقات العامة", "Public Relations"}
            ));
    }

    private void seedList(String listName, String labelAr, String labelEn, List<String[]> items) {
        if (refListRepo.findByListName(listName).isPresent()) return;
        ReferenceList list = ReferenceList.create(listName, labelAr, labelEn);
        refListRepo.save(list);
        int order = 1;
        for (String[] item : items) {
            list.getItems().add(ReferenceListItem.create(list.getId(), item[0], item[1], order++));
        }
        refListRepo.save(list);
    }
}
