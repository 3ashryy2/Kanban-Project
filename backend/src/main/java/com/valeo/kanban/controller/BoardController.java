package com.example.kanban.controller;

import com.example.kanban.dto.request.BoardCreateRequest;
import com.example.kanban.dto.request.ColumnCreateRequest;
import com.example.kanban.dto.request.ColumnReorderRequest;
import com.example.kanban.dto.response.AuditLogResponseDto;
import com.example.kanban.dto.response.BoardDetailsDto;
import com.example.kanban.dto.response.ColumnDto;
import com.example.kanban.dto.response.MembershipChangeResponseDto;
import com.example.kanban.dto.response.TaskDto;
import com.example.kanban.security.CustomUserDetails;
import com.example.kanban.service.AuditLogService;
import com.example.kanban.service.BoardMembershipService;
import com.example.kanban.service.BoardService;
import com.example.kanban.service.ColumnService;
import jakarta.validation.Valid;
import lombok.RequiredArgsConstructor;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.web.bind.annotation.*;
import java.util.List;

@RestController
@RequestMapping("/api/boards")
@RequiredArgsConstructor
@CrossOrigin(origins = "http://localhost:4200")
public class BoardController {

    private final BoardService boardService;
    private final ColumnService columnService;
    private final AuditLogService auditLogService;
    private final BoardMembershipService boardMembershipService;

    // People who may be assigned tasks on this board (explicit members + the workspace's PMs)
    @GetMapping("/{boardId}/members")
    @PreAuthorize("@boardSecurity.canReadBoard(#boardId, principal)")
    public ResponseEntity<List<TaskDto.SimpleUserDto>> getBoardMembers(@PathVariable Long boardId) {
        return ResponseEntity.ok(boardMembershipService.getAssignableUsers(boardId));
    }

    // Takes one member off this board. 200 with a body (not 204): the client shows how many tasks were unassigned
    @DeleteMapping("/{boardId}/members/{userId}")
    @PreAuthorize("@boardSecurity.isAdminOrManager(#boardId, principal)")
    public ResponseEntity<MembershipChangeResponseDto> removeBoardMember(
            @PathVariable Long boardId,
            @PathVariable Long userId,
            @AuthenticationPrincipal CustomUserDetails currentUser) {
        return ResponseEntity.ok(boardMembershipService.removeFromBoard(boardId, userId, currentUser));
    }

    @GetMapping("/{boardId}")
    @PreAuthorize("@boardSecurity.canReadBoard(#boardId, principal)")
    public ResponseEntity<BoardDetailsDto> getBoard(@PathVariable Long boardId) {
        BoardDetailsDto response = boardService.getBoardAggregate(boardId);
        return ResponseEntity.ok(response);
    }

    @PutMapping("/{boardId}")
    @PreAuthorize("@boardSecurity.isAdminOrManager(#boardId, principal)")
    public ResponseEntity<BoardDetailsDto> updateBoard(
            @PathVariable Long boardId,
            @Valid @RequestBody BoardCreateRequest request) {
        BoardDetailsDto response = boardService.updateBoard(boardId, request);
        return ResponseEntity.ok(response);
    }

    @DeleteMapping("/{boardId}")
    @PreAuthorize("@boardSecurity.isAdmin(#boardId, principal)")
    public ResponseEntity<Void> deleteBoard(@PathVariable Long boardId) {
        boardService.deleteBoard(boardId);
        return ResponseEntity.noContent().build();
    }

    // --- Column Layout Management ---

    @PostMapping("/{boardId}/columns")
    @PreAuthorize("@boardSecurity.isAdminOrManager(#boardId, principal)")
    public ResponseEntity<ColumnDto> createColumn(
            @PathVariable Long boardId,
            @Valid @RequestBody ColumnCreateRequest request) {
        ColumnDto response = columnService.createColumn(boardId, request);
        return ResponseEntity.status(HttpStatus.CREATED).body(response);
    }

    @PatchMapping("/{boardId}/columns/reorder")
    @PreAuthorize("@boardSecurity.isAdminOrManager(#boardId, principal)")
    public ResponseEntity<List<ColumnDto>> reorderColumn(
            @PathVariable Long boardId,
            @Valid @RequestBody ColumnReorderRequest request) {
        columnService.reorderColumn(boardId, request);
        BoardDetailsDto updatedBoard = boardService.getBoardAggregate(boardId);
        return ResponseEntity.ok(updatedBoard.getColumns());
    }

    // --- Side-panel Board Activity Feed ---

    @GetMapping("/{boardId}/activity")
    @PreAuthorize("@boardSecurity.canReadBoard(#boardId, principal)")
    public ResponseEntity<List<AuditLogResponseDto>> getBoardActivity(
            @PathVariable Long boardId,
            @RequestParam(defaultValue = "20") int limit) {
        List<AuditLogResponseDto> response = auditLogService.getBoardActivity(boardId, limit);
        return ResponseEntity.ok(response);
    }
}
