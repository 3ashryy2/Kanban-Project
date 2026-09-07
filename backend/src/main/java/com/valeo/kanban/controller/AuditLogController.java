package com.valeo.kanban.controller;

import com.valeo.kanban.dto.response.AuditLogResponseDto;
import com.valeo.kanban.service.AuditLogService;
import lombok.RequiredArgsConstructor;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.data.web.PageableDefault;
import org.springframework.http.ResponseEntity;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.web.bind.annotation.*;

@RestController
@RequestMapping("/api/audit-logs")
@RequiredArgsConstructor
@CrossOrigin(origins = "http://localhost:4200")
public class AuditLogController {

    private final AuditLogService auditLogService;

    @GetMapping
    @PreAuthorize("hasRole('ROLE_ADMIN') or (#workspaceId != null and @workspaceSecurity.isAdmin(#workspaceId, principal))")
    public ResponseEntity<Page<AuditLogResponseDto>> getAuditLogs(
            @RequestParam(required = false) Long workspaceId,
            @RequestParam(required = false) String actionType,
            @PageableDefault(size = 50) Pageable pageable) {
        Page<AuditLogResponseDto> response = auditLogService.getGlobalAuditLogs(workspaceId, actionType, pageable);
        return ResponseEntity.ok(response);
    }
}
