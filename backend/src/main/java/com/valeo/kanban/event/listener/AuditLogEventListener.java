package com.valeo.kanban.event.listener;

import com.fasterxml.jackson.databind.ObjectMapper;
import com.valeo.kanban.event.model.CardMovedEvent;
import com.valeo.kanban.event.model.GateApprovedEvent;
import com.valeo.kanban.event.model.GateRejectedEvent;
import com.valeo.kanban.model.entity.AuditLog;
import com.valeo.kanban.model.entity.User;
import com.valeo.kanban.repository.AuditLogRepository;
import com.valeo.kanban.repository.UserRepository;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.scheduling.annotation.Async;
import org.springframework.stereotype.Component;
import org.springframework.transaction.event.TransactionPhase;
import org.springframework.transaction.event.TransactionalEventListener;
import java.util.Map;

@Component
@RequiredArgsConstructor
@Slf4j
public class AuditLogEventListener {

    private final AuditLogRepository auditLogRepository;
    private final UserRepository userRepository;
    private final ObjectMapper objectMapper;

    private String toJson(Object value) {
        try {
            return objectMapper.writeValueAsString(value);
        } catch (Exception ex) {
            log.error("Failed to serialize details to JSON", ex);
            return "{}";
        }
    }

    @Async("auditExecutor")
    @TransactionalEventListener(phase = TransactionPhase.AFTER_COMMIT)
    public void handleCardMovedEvent(CardMovedEvent event) {
        try {
            log.info("Processing async CardMovedEvent for task {}", event.getTaskId());
            User actor = userRepository.getReferenceById(event.getActorId());

            AuditLog auditLog = AuditLog.builder()
                    .workspaceId(event.getWorkspaceId())
                    .boardId(event.getBoardId())
                    .taskId(event.getTaskId())
                    .actor(actor)
                    .actionType("CARD_MOVED")
                    .sourceColumnId(event.getSourceColumnId())
                    .targetColumnId(event.getTargetColumnId())
                    .details(toJson(Map.of("status", event.getStatus())))
                    .timestamp(event.getEventTimestamp())
                    .build();

            auditLogRepository.save(auditLog);
        } catch (Exception ex) {
            log.error("AUDIT_FAILURE | action=CARD_MOVED | taskId={} | actorId={} | " +
                      "sourceColumn={} | targetColumn={} | error={}",
                    event.getTaskId(), event.getActorId(),
                    event.getSourceColumnId(), event.getTargetColumnId(), ex.getMessage());
        }
    }

    @Async("auditExecutor")
    @TransactionalEventListener(phase = TransactionPhase.AFTER_COMMIT)
    public void handleGateApprovedEvent(GateApprovedEvent event) {
        try {
            log.info("Processing async GateApprovedEvent for task {}", event.getTaskId());
            User actor = userRepository.getReferenceById(event.getActorId());

            AuditLog auditLog = AuditLog.builder()
                    .workspaceId(event.getWorkspaceId())
                    .boardId(event.getBoardId())
                    .taskId(event.getTaskId())
                    .actor(actor)
                    .actionType("GATE_APPROVED")
                    .sourceColumnId(event.getColumnId())
                    .targetColumnId(event.getColumnId())
                    .details(toJson(Map.of("message", "Gate approved and unlocked")))
                    .timestamp(event.getEventTimestamp())
                    .build();

            auditLogRepository.save(auditLog);
        } catch (Exception ex) {
            log.error("AUDIT_FAILURE | action=GATE_APPROVED | taskId={} | actorId={} | " +
                      "columnId={} | error={}",
                    event.getTaskId(), event.getActorId(), event.getColumnId(), ex.getMessage());
        }
    }

    @Async("auditExecutor")
    @TransactionalEventListener(phase = TransactionPhase.AFTER_COMMIT)
    public void handleGateRejectedEvent(GateRejectedEvent event) {
        try {
            log.info("Processing async GateRejectedEvent for task {}", event.getTaskId());
            User actor = userRepository.getReferenceById(event.getActorId());

            AuditLog auditLog = AuditLog.builder()
                    .workspaceId(event.getWorkspaceId())
                    .boardId(event.getBoardId())
                    .taskId(event.getTaskId())
                    .actor(actor)
                    .actionType("GATE_REJECTED")
                    .sourceColumnId(null) // source is the gated column (which is the current task column, but was rejected back)
                    .targetColumnId(event.getFallbackColumnId())
                    .details(toJson(Map.of("reason", event.getRejectionReason())))
                    .timestamp(event.getEventTimestamp())
                    .build();

            auditLogRepository.save(auditLog);
        } catch (Exception ex) {
            log.error("AUDIT_FAILURE | action=GATE_REJECTED | taskId={} | actorId={} | " +
                      "fallbackColumn={} | reason={} | error={}",
                    event.getTaskId(), event.getActorId(), event.getFallbackColumnId(),
                    event.getRejectionReason(), ex.getMessage());
        }
    }

    @Async("auditExecutor")
    @TransactionalEventListener(phase = TransactionPhase.AFTER_COMMIT)
    public void handleTaskGenericAuditEvent(com.valeo.kanban.event.model.TaskGenericAuditEvent event) {
        try {
            log.info("Processing async TaskGenericAuditEvent action {} for task {}", event.getActionType(), event.getTaskId());
            User actor = userRepository.getReferenceById(event.getActorId());

            AuditLog auditLog = AuditLog.builder()
                    .workspaceId(event.getWorkspaceId())
                    .boardId(event.getBoardId())
                    .taskId(event.getTaskId())
                    .actor(actor)
                    .actionType(event.getActionType())
                    .details(event.getDetails())
                    .timestamp(event.getEventTimestamp())
                    .build();

            auditLogRepository.save(auditLog);
        } catch (Exception ex) {
            log.error("AUDIT_FAILURE | action={} | taskId={} | actorId={} | " +
                      "details={} | error={}",
                    event.getActionType(), event.getTaskId(), event.getActorId(),
                    event.getDetails(), ex.getMessage());
        }
    }
}
