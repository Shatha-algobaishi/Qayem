package com.qayem.hr.seeder;

import org.springframework.boot.ApplicationArguments;
import org.springframework.boot.ApplicationRunner;
import org.springframework.context.annotation.Profile;
import org.springframework.core.annotation.Order;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.stereotype.Component;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.transaction.annotation.Transactional;
import com.qayem.hr.entity.*;
import com.qayem.hr.enums.EvaluationDecision;
import com.qayem.hr.repository.*;
import java.time.LocalDate;

import java.math.BigDecimal;
import java.util.*;

@Component
@Profile("demo")
@Order(1)
public class DemoSeeder implements ApplicationRunner {
    @Value("${app.demo-password:}") private String demoPassword;
    private final UserRepository users;
    private final RoleRepository roles;
    private final UserRoleRepository userRoles;
    private final SessionRepository sessions;
    private final CandidateRepository candidates;
    private final CandidateEvaluatorRepository assignments;
    private final SessionEvaluatorRepository sessionEvaluators;
    private final EvaluationRepository evaluations;
    private final EvaluationAnswerRepository answers;
    private final QuestionRepository questions;
    private final NotificationRepository notifications;
    private final AuditLogRepository audit;
    private final PasswordEncoder encoder;

    public DemoSeeder(UserRepository users, RoleRepository roles, UserRoleRepository userRoles,
                      SessionRepository sessions, CandidateRepository candidates,
                      CandidateEvaluatorRepository assignments, SessionEvaluatorRepository sessionEvaluators,
                      EvaluationRepository evaluations, EvaluationAnswerRepository answers,
                      QuestionRepository questions, NotificationRepository notifications,
                      AuditLogRepository audit, PasswordEncoder encoder) {
        this.users=users; this.roles=roles; this.userRoles=userRoles; this.sessions=sessions;
        this.candidates=candidates; this.assignments=assignments; this.sessionEvaluators=sessionEvaluators;
        this.evaluations=evaluations; this.answers=answers; this.questions=questions;
        this.notifications=notifications; this.audit=audit; this.encoder=encoder;
    }

    @Override
    @Transactional
    public void run(ApplicationArguments args) {
        if (users.findByUsername("demo").isPresent()) return;
        if (demoPassword.isBlank()) demoPassword=UUID.randomUUID().toString();
        if (demoPassword.length()<12 || demoPassword.length()>72)
            throw new IllegalArgumentException("Set DEMO_PASSWORD to a local password of 12 to 72 characters.");
        var admin=roles.findByName("Admin").orElseThrow();
        var visitor=users.save(User.create("سارة", "Sara", "demo@example.invalid",
                "demo", encoder.encode(demoPassword), admin.getId(), null, "بيانات وهمية", "Demo visitor", null));
        roles.findAll().forEach(r -> userRoles.save(r.getId().equals(admin.getId())
                ? UserRole.createPrimary(visitor.getId(),r.getId(),null)
                : UserRole.create(visitor.getId(),r.getId(),null)));
        var evaluatorRole=roles.findByName("Evaluator").orElseThrow();
        List<User> panel=new ArrayList<>(); panel.add(visitor);
        String[][] evaluatorNames={{"ليلى","Layla"},{"فهد","Fahad"},{"هند","Hind"},{"يوسف","Yousef"},
                {"دلال","Dalal"},{"بدر","Badr"},{"أمل","Amal"}};
        for (int n=0;n<evaluatorNames.length;n++) {
            var name=evaluatorNames[n];
            var evaluator=users.save(User.create(name[0],name[1],"reviewer-"+(n+1)+"@example.com",
                    "reviewer-"+(n+1),encoder.encode(UUID.randomUUID().toString()),evaluatorRole.getId(),visitor.getId(),
                    "فريق التقييم التجريبي / Demo panel","أخصائي تقييم / Assessment specialist",null));
            userRoles.save(UserRole.createPrimary(evaluator.getId(),evaluatorRole.getId(),visitor.getId()));
            panel.add(evaluator);
        }
        String[][] sessionNames={
            {"مقابلات الموارد البشرية","Human resources interviews","أخصائي موارد بشرية","HR specialist","الموارد البشرية","HR policies, communication / سياسات الموارد البشرية والتواصل"},
            {"مقابلات تقنية المعلومات","Information technology interviews","مطور برمجيات","Software developer","تقنية المعلومات","Java, SQL, problem solving / حل المشكلات"},
            {"مقابلات المالية","Finance interviews","محلل مالي","Financial analyst","المالية","Budgeting, Excel / إعداد الميزانيات والتحليل المالي"},
            {"مقابلات التسويق","Marketing interviews","أخصائي تسويق","Marketing specialist","التسويق","Campaign planning, analytics / الحملات والتحليلات"},
            {"مقابلات العمليات","Operations interviews","محلل عمليات","Operations analyst","العمليات","Process improvement, planning / تحسين الإجراءات والتخطيط"},
            {"مقابلات خدمة العملاء","Customer service interviews","أخصائي تجربة عميل","Customer experience specialist","خدمة العملاء","Active listening, issue resolution / الإنصات ومعالجة الشكاوى"}
        };
        String[][] candidateNames={{"نورة","Noura"},{"ريم","Reem"},{"مها","Maha"},{"خالد","Khalid"},{"عمر","Omar"},
                {"فيصل","Faisal"},{"عبدالعزيز","Abdulaziz"},{"هيا","Haya"},{"جود","Joud"},{"لينا","Lina"},
                {"راكان","Rakan"},{"منى","Mona"},{"سلمى","Salma"},{"زياد","Ziyad"},{"روان","Rawan"},
                {"تركي","Turki"},{"شهد","Shahad"},{"محمد","Mohammed"},{"عبير","Abeer"},{"عبدالله","Abdullah"},
                {"نجود","Noujoud"},{"مازن","Mazen"},{"لطيفة","Latifa"},{"إبراهيم","Ibrahim"},{"رغد","Raghad"},
                {"أحمد","Ahmed"},{"شوق","Shouq"},{"ناصر","Nasser"},{"غادة","Ghada"},{"سلطان","Sultan"}};
        var anchor=LocalDate.now().withDayOfMonth(1).atTime(9,0);
        List<InterviewSession> demoSessions=new ArrayList<>();
        for(int i=0;i<6;i++) {
            var names=sessionNames[i];
            var session=sessions.save(InterviewSession.create(String.format(Locale.ROOT,"DEMO-%03d",i+1),names[0],names[1],
                    names[2],names[3],names[4],visitor.getId(),anchor.plusDays(i*5L),
                    "غرفة تجريبية / Demo room "+(i+1),"Fictional demo session / جلسة افتراضية", "Qayem Demo","التطوير الوظيفي"));
            if(i==0 || i==3 || i==4) {session.close(visitor.getId());sessions.save(session);}
            demoSessions.add(session);
            for(var evaluator:panel) sessionEvaluators.save(SessionEvaluator.create(session.getId(),evaluator.getId(),visitor.getId()));
        }
        // Exact totals across six active questions; null means still awaiting an evaluation.
        int[][] totals={{28,27,29},{21,22,20},{12,13,11},{28,15,25},{0,-1,-1},{-1,-1,-1},
                        {25,26,25},{18,0,-1},{-1,-1,-1},{16,17,16},{22,23,22},{30,18,24},
                        {27,28,27},{20,21,22},{14,12,13},{26,16,28},{0,-1,-1},{-1,-1,-1},
                        {29,28,30},{22,0,-1},{24,25,24},{19,20,18},{10,11,12},{28,16,26},
                        {26,27,25},{0,-1,-1},{-1,-1,-1},{15,16,14},{21,22,20},{27,0,-1}};
        EvaluationDecision[] decisions={EvaluationDecision.Employed,EvaluationDecision.ConditionallyQualified,
                EvaluationDecision.NotQualified,null,null,null,EvaluationDecision.Recommended,null,null,
                EvaluationDecision.ConditionallyQualified,EvaluationDecision.Recommended,EvaluationDecision.NotQualified};
        List<Question> active=questions.findByIsActiveTrueOrderByOrderIndex();
        if(active.size()!=6) throw new IllegalStateException("Demo fixture requires six questions.");
        for(int i=0;i<30;i++) {
            int departmentIndex=i<12?i/3:i<20?(i-12)/2:i<25?4:5;
            var session=demoSessions.get(departmentIndex);
            var profile=sessionNames[departmentIndex];
            var name=candidateNames[i];
            var candidate=candidates.save(Candidate.create(session.getId(),String.format(Locale.ROOT,"DEMO-C%03d",i+1),
                    name[0],name[1],visitor.getId(),
                    "candidate-"+(i+1)+"@example.com",null,i%3==0?"ماجستير":"بكالوريوس",
                    profile[4],profile[1],(short)(1+i%10),
                    "ملف وهمي بالكامل. المهارات / Skills: "+profile[5]+". خبرة في مشاريع تدريبية وتحسين إجراءات العمل / Simulated projects and process improvement.",
                    i%3==0?"تمهير":"وظيفة",BigDecimal.valueOf(3.2+(i%5)*0.1),"4.0",
                    "أكاديمية افتراضية / Fictional Academy","شركة تجريبية / Fictional company",profile[2]+" / "+profile[3],name[0],null,null));
            candidate.scheduleInterview(session.getScheduledDate().plusHours(i%3),session.getLocation());
            List<Integer> submittedTotals=new ArrayList<>(); boolean hasDraft=false;
            for(int j=0;j<3;j++) {
                var evaluator=panel.get(j==0?0:1+(i+j-1)%7);
                assignments.save(CandidateEvaluator.create(candidate.getId(),evaluator.getId(),visitor.getId()));
                if(totals[i][j]<0) continue;
                var evaluation=evaluations.save(Evaluation.create(candidate.getId(),session.getId(),evaluator.getId()));
                List<EvaluationAnswer> saved=new ArrayList<>();
                int count=totals[i][j]==0?3:6;
                for(int q=0;q<count;q++) {
                    int score=totals[i][j]==0?3:totals[i][j]/6+(q<totals[i][j]%6?1:0);
                    saved.add(EvaluationAnswer.create(evaluation.getId(),active.get(q).getId(),score,
                            "درجة وهمية للتوضيح / Fictional demonstration score"));
                }
                answers.saveAll(saved);evaluation.getAnswers().addAll(saved);
                evaluation.setNotes("مثال تجريبي لا يخص شخصًا حقيقيًا / Fictional example, not a real assessment");
                if(totals[i][j]>0) {
                    evaluation.submit(6,BigDecimal.valueOf(17),BigDecimal.valueOf(23));
                    if(i<decisions.length && decisions[i]!=null || i>=12 && i%6<3) evaluation.markReviewed();
                    submittedTotals.add(evaluation.getTotalScore());
                } else hasDraft=true;
                evaluations.save(evaluation);
            }
            if(!submittedTotals.isEmpty()) {
                candidate.updateAggregateScore(BigDecimal.valueOf(submittedTotals.stream().mapToInt(Integer::intValue).average().orElseThrow()),
                        BigDecimal.valueOf(Collections.max(submittedTotals)),BigDecimal.valueOf(Collections.min(submittedTotals)),
                        BigDecimal.valueOf(5),BigDecimal.valueOf(17),BigDecimal.valueOf(23));
            }
            if(submittedTotals.size()==3) candidate.markCompleted();
            else if(hasDraft || !submittedTotals.isEmpty()) candidate.markInProgress();
            EvaluationDecision finalDecision=i<decisions.length?decisions[i]
                    :submittedTotals.size()==3 && i%6<3?candidate.getSystemDecision():null;
            if(finalDecision!=null) {
                candidate.applyManagerDecision(finalDecision,"قرار افتراضي للتوضيح / Fictional demonstration decision",visitor.getId());
                audit.save(AuditLog.create("MANAGER_DECISION","Candidate",candidate.getId().toString(),visitor.getId()));
            }
            candidates.save(candidate);
        }
        notifications.save(Notification.create(visitor.getId(),"مرحبًا بك في قيّم","Welcome to Qayem",
                "استكشف البيانات الوهمية والأدوار الأربعة والتقارير.","Explore fictional data, four roles and reports.",
                "Info","Demo","overview"));
        notifications.save(Notification.create(visitor.getId(),"تباين يحتاج إلى مراجعة","Discrepancy to review",
                "يوضح الديمو تقييمات مختلفة للمرشح نفسه.","The demo includes differing scores for the same candidate.",
                "Discrepancy","Demo","comparison"));
        audit.save(AuditLog.create("DEMO_DATA_INITIALIZED","Demo","fixture-v3",visitor.getId()));
    }
}
