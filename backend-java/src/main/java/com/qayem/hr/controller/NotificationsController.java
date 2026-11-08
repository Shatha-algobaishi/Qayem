package com.qayem.hr.controller;

import org.springframework.data.domain.*;
import org.springframework.http.ResponseEntity;
import org.springframework.security.core.Authentication;
import org.springframework.web.bind.annotation.*;
import com.qayem.hr.entity.Notification;
import com.qayem.hr.repository.NotificationRepository;

import java.util.*;
import java.util.stream.Collectors;

@RestController
@RequestMapping("/api/v1/notifications")
public class NotificationsController {

    private final NotificationRepository notifRepo;

    public NotificationsController(NotificationRepository notifRepo) {
        this.notifRepo = notifRepo;
    }

    @GetMapping
    public ResponseEntity<?> getNotifications(@RequestParam(defaultValue = "false") boolean unreadOnly,
                                               @RequestParam(defaultValue = "1") int page,
                                               @RequestParam(defaultValue = "20") int pageSize,
                                               Authentication auth) {
        UUID me = UUID.fromString((String) auth.getPrincipal());
        Pageable pageable = PageRequest.of(page - 1, pageSize, Sort.by(Sort.Direction.DESC, "createdAt"));

        Page<Notification> pg = unreadOnly
                ? notifRepo.findByUserIdAndIsReadFalse(me, pageable)
                : notifRepo.findByUserId(me, pageable);

        List<Map<String, Object>> items = pg.getContent().stream().map(n -> Map.<String, Object>of(
            "id", n.getId(), "titleAr", n.getTitleAr(), "titleEn", n.getTitleEn(),
            "messageAr", n.getMessageAr(), "messageEn", n.getMessageEn(),
            "type", Objects.toString(n.getType(), ""), "isRead", n.isRead(),
            "entityType", Objects.toString(n.getEntityType(), ""),
            "entityId", Objects.toString(n.getEntityId(), ""), "createdAt", n.getCreatedAt()
        )).collect(Collectors.toList());

        return ResponseEntity.ok(Map.of(
            "items", items,
            "totalCount", pg.getTotalElements(),
            "unreadCount", notifRepo.countByUserIdAndIsReadFalse(me)
        ));
    }

    @GetMapping("/unread-count")
    public ResponseEntity<?> getUnreadCount(Authentication auth) {
        UUID me = UUID.fromString((String) auth.getPrincipal());
        return ResponseEntity.ok(notifRepo.countByUserIdAndIsReadFalse(me));
    }

    @PostMapping("/{id}/read")
    public ResponseEntity<?> markRead(@PathVariable UUID id, Authentication auth) {
        UUID me = UUID.fromString((String) auth.getPrincipal());
        Notification n = notifRepo.findByIdAndUserId(id, me).orElse(null);
        if (n == null) return ResponseEntity.notFound().build();
        n.markRead(); notifRepo.save(n);
        return ResponseEntity.noContent().build();
    }

    @PostMapping("/read-all")
    public ResponseEntity<?> markAllRead(Authentication auth) {
        UUID me = UUID.fromString((String) auth.getPrincipal());
        Pageable all = Pageable.unpaged();
        notifRepo.findByUserIdAndIsReadFalse(me, all).forEach(n -> { n.markRead(); notifRepo.save(n); });
        return ResponseEntity.noContent().build();
    }
}
