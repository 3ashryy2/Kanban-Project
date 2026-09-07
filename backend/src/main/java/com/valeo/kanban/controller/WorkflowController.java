package com.valeo.kanban.controller;

import com.valeo.kanban.dto.request.WorkflowTransitionUpdateRequest;
import com.valeo.kanban.service.workflow.WorkflowTransitionService;
import jakarta.validation.Valid;
import lombok.RequiredArgsConstructor;
import org.springframework.http.ResponseEntity;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.web.bind.annotation.*;
import java.util.List;

@RestController
@RequestMapping("/api/boards/{boardId}/transitions")
@RequiredArgsConstructor
@CrossOrigin(origins = "http://localhost:4200")
public class WorkflowController {

    private final WorkflowTransitionService transitionService;

    @GetMapping
    @PreAuthorize("@boardSecurity.canReadBoard(#boardId, principal)")
    public ResponseEntity<List<WorkflowTransitionUpdateRequest>> getTransitions(@PathVariable Long boardId) {
        List<WorkflowTransitionUpdateRequest> response = transitionService.getTransitions(boardId);
        return ResponseEntity.ok(response);
    }

    @PutMapping
    @PreAuthorize("@boardSecurity.isAdminOrManager(#boardId, principal)")
    public ResponseEntity<List<WorkflowTransitionUpdateRequest>> updateTransitions(
            @PathVariable Long boardId,
            @Valid @RequestBody List<WorkflowTransitionUpdateRequest> requests) {
        List<WorkflowTransitionUpdateRequest> response = transitionService.updateTransitions(boardId, requests);
        return ResponseEntity.ok(response);
    }
}
