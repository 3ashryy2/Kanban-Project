package com.example.kanban.dto.mapper;

import com.example.kanban.model.entity.AuditLog;
import com.example.kanban.dto.response.AuditLogResponseDto;

public class AuditLogMapper {

    public static AuditLogResponseDto toDto(AuditLog auditLog) {
        if (auditLog == null) return null;
        return AuditLogResponseDto.builder()
                .id(auditLog.getId())
                .workspaceId(auditLog.getWorkspaceId())
                .boardId(auditLog.getBoardId())
                .taskId(auditLog.getTaskId())
                .actor(UserMapper.toSimpleUserDto(auditLog.getActor()))
                .actionType(auditLog.getActionType())
                .sourceColumnId(auditLog.getSourceColumnId())
                .targetColumnId(auditLog.getTargetColumnId())
                .details(auditLog.getDetails())
                .timestamp(auditLog.getTimestamp())
                .build();
    }
}
