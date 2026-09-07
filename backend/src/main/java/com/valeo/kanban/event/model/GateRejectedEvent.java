package com.valeo.kanban.event.model;

import lombok.Getter;
import org.springframework.context.ApplicationEvent;
import java.time.Instant;

@Getter
public class GateRejectedEvent extends ApplicationEvent {

    private final Long workspaceId;
    private final Long boardId;
    private final Long taskId;
    private final Long actorId;
    private final Long fallbackColumnId;
    private final String rejectionReason;
    private final Instant eventTimestamp;

    public GateRejectedEvent(Object source, Long workspaceId, Long boardId, Long taskId, Long actorId, Long fallbackColumnId, String rejectionReason) {
        super(source);
        this.workspaceId = workspaceId;
        this.boardId = boardId;
        this.taskId = taskId;
        this.actorId = actorId;
        this.fallbackColumnId = fallbackColumnId;
        this.rejectionReason = rejectionReason;
        this.eventTimestamp = Instant.now();
    }
}
