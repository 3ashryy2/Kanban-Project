package com.valeo.kanban.security.evaluator;

import com.valeo.kanban.model.enums.WorkspaceRole;
import com.valeo.kanban.repository.BoardRepository;
import com.valeo.kanban.repository.ColumnRepository;
import com.valeo.kanban.repository.TaskRepository;
import com.valeo.kanban.repository.WorkspaceMemberRepository;
import com.valeo.kanban.security.BoardAccessService;
import com.valeo.kanban.security.CustomUserDetails;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Component;
import java.util.Optional;

@Component("boardSecurity")
@RequiredArgsConstructor
public class BoardSecurityEvaluator {

    private final BoardRepository boardRepository;
    private final TaskRepository taskRepository;
    private final ColumnRepository columnRepository;
    private final WorkspaceMemberRepository workspaceMemberRepository;
    private final WorkspaceSecurityEvaluator workspaceSecurity;
    private final BoardAccessService boardAccess;

    public boolean isAdminOrManager(Long boardId, CustomUserDetails currentUser) {
        if (boardId == null || currentUser == null) return false;
        if (currentUser.isAdmin()) return true;
        return boardRepository.findById(boardId)
                .map(b -> {
                    WorkspaceRole role = workspaceMemberRepository
                            .findByWorkspaceIdAndUserId(b.getWorkspace().getId(), currentUser.getId())
                            .map(com.valeo.kanban.model.entity.WorkspaceMember::getRole)
                            .orElse(null);
                    return role == WorkspaceRole.ROLE_PROJECT_MANAGER;
                })
                .orElse(false);
    }

    public boolean isAdminOrManagerByColumnId(Long columnId, CustomUserDetails currentUser) {
        if (columnId == null || currentUser == null) return false;
        if (currentUser.isAdmin()) return true;
        return columnRepository.findById(columnId)
                .map(c -> isAdminOrManager(c.getBoard().getId(), currentUser))
                .orElse(false);
    }

    public boolean canCreateTaskInColumn(Long boardId, Long columnId, Long assigneeId, CustomUserDetails currentUser) {
        if (boardId == null || columnId == null || currentUser == null) return false;
        if (currentUser.isAdmin()) return true;
        // Must be able to open the board, and viewers stay read-only
        Optional<WorkspaceRole> role = boardAccess.roleOnBoard(boardId, currentUser.getId());
        if (role.isEmpty() || role.get() == WorkspaceRole.ROLE_VIEWER) return false;
        if (role.get() == WorkspaceRole.ROLE_PROJECT_MANAGER) return true;
        // Developers and QA may put only themselves on a new card, as when taking an unassigned one
        if (assigneeId != null && !assigneeId.equals(currentUser.getId())) return false;
        // Developers and QA start every card in the first column; later stages are reached only through the workflow
        return columnRepository.findFirstByBoardIdOrderByPositionAsc(boardId)
                .map(first -> first.getId().equals(columnId))
                .orElse(false);
    }

    public boolean canApproveTask(Long taskId, CustomUserDetails currentUser) {
        if (taskId == null || currentUser == null) return false;
        if (currentUser.isAdmin()) return true;
        return taskRepository.findById(taskId)
                .map(t -> {
                    Long workspaceId = t.getBoard().getWorkspace().getId();
                    return workspaceMemberRepository
                            .findByWorkspaceIdAndUserId(workspaceId, currentUser.getId())
                            .map(m -> m.getRole() == WorkspaceRole.ROLE_PROJECT_MANAGER)
                            .orElse(false);
                })
                .orElse(false);
    }

    public boolean canReadBoard(Long boardId, CustomUserDetails currentUser) {
        return boardAccess.canAccessBoard(boardId, currentUser);
    }

    public boolean canReadTask(Long taskId, CustomUserDetails currentUser) {
        if (taskId == null || currentUser == null) return false;
        return taskRepository.findBoardIdById(taskId)
                .map(boardId -> boardAccess.canAccessBoard(boardId, currentUser))
                .orElse(false);
    }

    public boolean isAdmin(Long boardId, CustomUserDetails currentUser) {
        if (boardId == null || currentUser == null) return false;
        return boardRepository.findById(boardId)
                .map(b -> workspaceSecurity.isAdmin(b.getWorkspace().getId(), currentUser))
                .orElse(false);
    }
}
