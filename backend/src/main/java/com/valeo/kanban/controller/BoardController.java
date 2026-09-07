package com.valeo.kanban.controller;

import com.valeo.kanban.dto.request.BoardCreateRequest;
import com.valeo.kanban.dto.request.ColumnCreateRequest;
import com.valeo.kanban.dto.request.ColumnReorderRequest;
import com.valeo.kanban.dto.response.AuditLogResponseDto;
import com.valeo.kanban.dto.response.BoardDetailsDto;
import com.valeo.kanban.dto.response.ColumnDto;
import com.valeo.kanban.service.AuditLogService;
import com.valeo.kanban.service.BoardService;
import com.valeo.kanban.service.ColumnService;
import jakarta.validation.Valid;
import lombok.RequiredArgsConstructor;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.security.access.prepost.PreAuthorize;
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
