package com.valeo.kanban.event.model;

import lombok.Getter;
import org.springframework.context.ApplicationEvent;
import java.time.Instant;

@Getter
public class CardMovedEvent extends ApplicationEvent {

    private final Long workspaceId;
    private final Long boardId;
    private final Long taskId;
    private final Long actorId;
    private final Long sourceColumnId;
    private final Long targetColumnId;
    private final String status;
    private final Instant eventTimestamp;

    public CardMovedEvent(Object source, Long workspaceId, Long boardId, Long taskId, Long actorId,
                          Long sourceColumnId, Long targetColumnId, String status) {
        super(source);
        this.workspaceId = workspaceId;
        this.boardId = boardId;
        this.taskId = taskId;
        this.actorId = actorId;
        this.sourceColumnId = sourceColumnId;
        this.targetColumnId = targetColumnId;
        this.status = status;
        this.eventTimestamp = Instant.now();
    }
}
