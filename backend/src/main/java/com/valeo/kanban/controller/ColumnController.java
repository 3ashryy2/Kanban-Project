package com.example.kanban.controller;

import com.example.kanban.dto.request.ColumnUpdateRequest;
import com.example.kanban.dto.response.ColumnDto;
import com.example.kanban.service.ColumnService;
import jakarta.validation.Valid;
import lombok.RequiredArgsConstructor;
import org.springframework.http.ResponseEntity;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.web.bind.annotation.*;

@RestController
@RequestMapping("/api/columns")
@RequiredArgsConstructor
@CrossOrigin(origins = "http://localhost:4200")
public class ColumnController {

    private final ColumnService columnService;

    @PutMapping("/{columnId}")
    @PreAuthorize("@boardSecurity.isAdminOrManagerByColumnId(#columnId, principal)")
    public ResponseEntity<ColumnDto> updateColumn(
            @PathVariable Long columnId,
            @Valid @RequestBody ColumnUpdateRequest request) {
        ColumnDto response = columnService.updateColumn(columnId, request);
        return ResponseEntity.ok(response);
    }

    @DeleteMapping("/{columnId}")
    @PreAuthorize("@boardSecurity.isAdminOrManagerByColumnId(#columnId, principal)")
    public ResponseEntity<Void> deleteColumn(@PathVariable Long columnId) {
        columnService.deleteColumn(columnId);
        return ResponseEntity.noContent().build();
    }
}
