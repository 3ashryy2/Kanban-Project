package com.valeo.kanban.service;

import com.valeo.kanban.dto.response.AuditLogResponseDto;
import com.valeo.kanban.dto.mapper.AuditLogMapper;
import com.valeo.kanban.repository.AuditLogRepository;
import lombok.RequiredArgsConstructor;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.PageRequest;
import org.springframework.data.domain.Pageable;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import java.util.List;
import java.util.stream.Collectors;

@Service
@RequiredArgsConstructor
public class AuditLogService {

    private final AuditLogRepository auditLogRepository;

    @Transactional(readOnly = true)
    public Page<AuditLogResponseDto> getGlobalAuditLogs(Long workspaceId, String actionType, Pageable pageable) {
        if (workspaceId != null) {
            if (actionType != null && !actionType.trim().isEmpty()) {
                return auditLogRepository.findByWorkspaceIdAndActionTypeOrderByTimestampDesc(workspaceId, actionType.toUpperCase(), pageable)
                        .map(AuditLogMapper::toDto);
            }
            return auditLogRepository.findByWorkspaceIdOrderByTimestampDesc(workspaceId, pageable)
                    .map(AuditLogMapper::toDto);
        } else {
            if (actionType != null && !actionType.trim().isEmpty()) {
                return auditLogRepository.findByActionTypeOrderByTimestampDesc(actionType.toUpperCase(), pageable)
                        .map(AuditLogMapper::toDto);
            }
            return auditLogRepository.findAllByOrderByTimestampDesc(pageable)
                    .map(AuditLogMapper::toDto);
        }
    }

    @Transactional(readOnly = true)
    public List<AuditLogResponseDto> getBoardActivity(Long boardId, int limit) {
        Pageable pageable = PageRequest.of(0, limit, org.springframework.data.domain.Sort.by("timestamp").descending());
        return auditLogRepository.findByBoardIdOrderByTimestampDesc(boardId, pageable)
                .getContent()
                .stream()
                .map(AuditLogMapper::toDto)
                .collect(Collectors.toList());
    }

    @Transactional(readOnly = true)
    public List<AuditLogResponseDto> getTaskHistory(Long taskId, int limit) {
        Pageable pageable = PageRequest.of(0, limit, org.springframework.data.domain.Sort.by("timestamp").descending());
        return auditLogRepository.findByTaskIdOrderByTimestampDesc(taskId, pageable)
                .getContent()
                .stream()
                .map(AuditLogMapper::toDto)
                .collect(Collectors.toList());
    }
}
