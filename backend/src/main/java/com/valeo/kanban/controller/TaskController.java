package com.valeo.kanban.controller;

import com.valeo.kanban.dto.request.*;
import com.valeo.kanban.dto.response.AuditLogResponseDto;
import com.valeo.kanban.dto.response.TaskDto;
import com.valeo.kanban.security.CustomUserDetails;
import com.valeo.kanban.service.AuditLogService;
import com.valeo.kanban.service.TaskService;
import com.valeo.kanban.service.workflow.ApprovalGateService;
import com.valeo.kanban.service.workflow.TaskWorkflowService;
import jakarta.validation.Valid;
import lombok.RequiredArgsConstructor;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.web.bind.annotation.*;
import java.util.List;

@RestController
@RequestMapping("/api/tasks")
@RequiredArgsConstructor
@CrossOrigin(origins = "http://localhost:4200")
public class TaskController {

    private final TaskService taskService;
    private final TaskWorkflowService taskWorkflowService;
    private final ApprovalGateService approvalGateService;
    private final AuditLogService auditLogService;

    @PostMapping
    @PreAuthorize("@boardSecurity.canCreateTaskOnBoard(#request.boardId, principal)")
    public ResponseEntity<TaskDto> createTask(
            @Valid @RequestBody TaskCreateRequest request,
            @AuthenticationPrincipal CustomUserDetails currentUser) {
        TaskDto response = taskService.createTask(request, currentUser);
        return ResponseEntity.status(HttpStatus.CREATED).body(response);
    }

    @GetMapping("/{taskId}")
    @PreAuthorize("@boardSecurity.canReadTask(#taskId, principal)")
    public ResponseEntity<TaskDto> getTask(@PathVariable Long taskId) {
        TaskDto response = taskService.getTaskById(taskId);
        return ResponseEntity.ok(response);
    }

    @PatchMapping("/{taskId}/move")
    @PreAuthorize("@taskSecurity.canMoveCard(#taskId, principal)")
    public ResponseEntity<TaskDto> moveTask(
            @PathVariable Long taskId,
            @Valid @RequestBody TaskMoveRequest request,
            @AuthenticationPrincipal CustomUserDetails currentUser) {
        TaskDto response = taskWorkflowService.moveTask(taskId, request, currentUser);
        return ResponseEntity.ok(response);
    }

    @PatchMapping("/{taskId}/metadata")
    @PreAuthorize("@taskSecurity.canEditCard(#taskId, principal)")
    public ResponseEntity<TaskDto> updateMetadata(
            @PathVariable Long taskId,
            @Valid @RequestBody TaskMetadataRequest request,
            @AuthenticationPrincipal CustomUserDetails currentUser) {
        TaskDto response = taskService.updateMetadata(taskId, request, currentUser);
        return ResponseEntity.ok(response);
    }

    @PatchMapping("/{taskId}/assignee")
    @PreAuthorize("@taskSecurity.canAssignCard(#taskId, #request, principal)")
    public ResponseEntity<TaskDto> updateAssignee(
            @PathVariable Long taskId,
            @Valid @RequestBody TaskAssigneeRequest request,
            @AuthenticationPrincipal CustomUserDetails currentUser) {
        TaskDto response = taskService.updateAssignee(taskId, request, currentUser);
        return ResponseEntity.ok(response);
    }

    @PostMapping("/{taskId}/approve")
    @PreAuthorize("@boardSecurity.canApproveTask(#taskId, principal)")
    public ResponseEntity<TaskDto> approveTask(
            @PathVariable Long taskId,
            @Valid @RequestBody TaskApproveRequest request,
            @AuthenticationPrincipal CustomUserDetails currentUser) {
        TaskDto response = approvalGateService.approveTask(taskId, request, currentUser);
        return ResponseEntity.ok(response);
    }

    @PostMapping("/{taskId}/reject")
    @PreAuthorize("@boardSecurity.canApproveTask(#taskId, principal)")
    public ResponseEntity<TaskDto> rejectTask(
            @PathVariable Long taskId,
            @Valid @RequestBody TaskRejectRequest request,
            @AuthenticationPrincipal CustomUserDetails currentUser) {
        TaskDto response = approvalGateService.rejectTask(taskId, request, currentUser);
        return ResponseEntity.ok(response);
    }

    @DeleteMapping("/{taskId}")
    @PreAuthorize("@taskSecurity.canDeleteCard(#taskId, principal)")
    public ResponseEntity<Void> deleteTask(
            @PathVariable Long taskId,
            @AuthenticationPrincipal CustomUserDetails currentUser) {
        taskService.deleteTask(taskId, currentUser);
        return ResponseEntity.noContent().build();
    }

    @GetMapping("/{taskId}/history")
    @PreAuthorize("@boardSecurity.canReadTask(#taskId, principal)")
    public ResponseEntity<List<AuditLogResponseDto>> getTaskHistory(
            @PathVariable Long taskId,
            @RequestParam(defaultValue = "50") int limit) {
        List<AuditLogResponseDto> response = auditLogService.getTaskHistory(taskId, limit);
        return ResponseEntity.ok(response);
    }
}
