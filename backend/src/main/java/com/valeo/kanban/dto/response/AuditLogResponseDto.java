package com.valeo.kanban.dto.response;

import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;
import java.time.Instant;

@Data
@NoArgsConstructor
@AllArgsConstructor
@Builder
public class AuditLogResponseDto {
    private Long id;
    private Long workspaceId;
    private Long boardId;
    private Long taskId;
    private TaskDto.SimpleUserDto actor;
    private String actionType;
    private Long sourceColumnId;
    private Long targetColumnId;
    private String details;
    private Instant timestamp;
}
