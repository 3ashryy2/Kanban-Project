package com.valeo.kanban.event.model;

import lombok.Getter;
import org.springframework.context.ApplicationEvent;
import java.time.Instant;

@Getter
public class TaskGenericAuditEvent extends ApplicationEvent {

    private final Long workspaceId;
    private final Long boardId;
    private final Long taskId;
    private final Long actorId;
    private final String actionType;
    private final String details;
    private final Instant eventTimestamp;

    public TaskGenericAuditEvent(Object source, Long workspaceId, Long boardId, Long taskId, Long actorId, String actionType, String details) {
        super(source);
        this.workspaceId = workspaceId;
        this.boardId = boardId;
        this.taskId = taskId;
        this.actorId = actorId;
        this.actionType = actionType;
        this.details = details;
        this.eventTimestamp = Instant.now();
    }
}
