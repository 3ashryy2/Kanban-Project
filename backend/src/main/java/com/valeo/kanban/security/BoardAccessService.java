package com.valeo.kanban.security;

import com.valeo.kanban.model.entity.User;
import com.valeo.kanban.model.entity.WorkspaceMember;
import com.valeo.kanban.model.enums.WorkspaceRole;
import com.valeo.kanban.repository.BoardMemberRepository;
import com.valeo.kanban.repository.BoardRepository;
import com.valeo.kanban.repository.UserRepository;
import com.valeo.kanban.repository.WorkspaceMemberRepository;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Component;
import org.springframework.transaction.annotation.Transactional;
import java.util.Optional;

/**
 * The single rule for opening a board: the global admin, a Project Manager of the board's workspace,
 * or a workspace member with an explicit board membership.
 */
@Component
@RequiredArgsConstructor
@Transactional(readOnly = true)
public class BoardAccessService {

    private final BoardRepository boardRepository;
    private final WorkspaceMemberRepository workspaceMemberRepository;
    private final BoardMemberRepository boardMemberRepository;
    private final UserRepository userRepository;

    public boolean canAccessBoard(Long boardId, CustomUserDetails user) {
        if (boardId == null || user == null) return false;
        if (user.isAdmin()) return true;
        return roleOnBoard(boardId, user.getId()).isPresent();
    }

    /** Same rule for any user, e.g. someone proposed as a task assignee. */
    public boolean userCanAccessBoard(Long userId, Long boardId) {
        if (userId == null || boardId == null) return false;
        boolean isAdmin = userRepository.findById(userId).map(User::isAdmin).orElse(false);
        return isAdmin || roleOnBoard(boardId, userId).isPresent();
    }

    /**
     * The user's workspace role on this board, present only if they may open it:
     * PMs always, other members only with a board membership. Empty for non-members.
     */
    public Optional<WorkspaceRole> roleOnBoard(Long boardId, Long userId) {
        return boardRepository.findWorkspaceIdById(boardId)
                .flatMap(workspaceId -> workspaceMemberRepository.findByWorkspaceIdAndUserId(workspaceId, userId))
                .filter(member -> member.getRole() == WorkspaceRole.ROLE_PROJECT_MANAGER
                        || boardMemberRepository.existsByBoardIdAndUserId(boardId, userId))
                .map(WorkspaceMember::getRole);
    }

    /** Which boards of a workspace the user may open. */
    public BoardScope scopeFor(Long workspaceId, CustomUserDetails user) {
        if (user.isAdmin()) return BoardScope.ALL;
        return workspaceMemberRepository.findByWorkspaceIdAndUserId(workspaceId, user.getId())
                .map(member -> member.getRole() == WorkspaceRole.ROLE_PROJECT_MANAGER
                        ? BoardScope.ALL
                        : BoardScope.of(boardMemberRepository.findBoardIdsByWorkspaceIdAndUserId(workspaceId, user.getId())))
                .orElse(BoardScope.NONE);
    }
}
