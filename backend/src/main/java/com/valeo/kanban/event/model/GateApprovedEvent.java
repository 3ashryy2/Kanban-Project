package com.valeo.kanban.event.model;

import lombok.Getter;
import org.springframework.context.ApplicationEvent;
import java.time.Instant;

@Getter
public class GateApprovedEvent extends ApplicationEvent {

    private final Long workspaceId;
    private final Long boardId;
    private final Long taskId;
    private final Long actorId;
    private final Long columnId;
    private final Instant eventTimestamp;

    public GateApprovedEvent(Object source, Long workspaceId, Long boardId, Long taskId, Long actorId, Long columnId) {
        super(source);
        this.workspaceId = workspaceId;
        this.boardId = boardId;
        this.taskId = taskId;
        this.actorId = actorId;
        this.columnId = columnId;
        this.eventTimestamp = Instant.now();
    }
}
