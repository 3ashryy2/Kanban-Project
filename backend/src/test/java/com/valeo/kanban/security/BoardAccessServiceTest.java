package com.valeo.kanban.security;

import com.valeo.kanban.model.entity.User;
import com.valeo.kanban.model.entity.WorkspaceMember;
import com.valeo.kanban.model.enums.WorkspaceRole;
import com.valeo.kanban.repository.BoardMemberRepository;
import com.valeo.kanban.repository.BoardRepository;
import com.valeo.kanban.repository.UserRepository;
import com.valeo.kanban.repository.WorkspaceMemberRepository;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.InjectMocks;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import java.util.List;
import java.util.Optional;
import java.util.Set;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.Mockito.verifyNoInteractions;
import static org.mockito.Mockito.when;

@ExtendWith(MockitoExtension.class)
class BoardAccessServiceTest {

    private static final long WORKSPACE = 1L;
    private static final long BOARD = 10L;

    @Mock private BoardRepository boardRepository;
    @Mock private WorkspaceMemberRepository workspaceMemberRepository;
    @Mock private BoardMemberRepository boardMemberRepository;
    @Mock private UserRepository userRepository;

    @InjectMocks private BoardAccessService boardAccess;

    @Test
    void theGlobalAdminOpensAnyBoardWithoutAnyLookup() {
        assertThat(boardAccess.canAccessBoard(BOARD, principal(1L, true))).isTrue();
        verifyNoInteractions(boardRepository, workspaceMemberRepository, boardMemberRepository);
    }

    @Test
    void aProjectManagerOpensEveryBoardWithoutAMembershipRow() {
        when(boardRepository.findWorkspaceIdById(BOARD)).thenReturn(Optional.of(WORKSPACE));
        when(workspaceMemberRepository.findByWorkspaceIdAndUserId(WORKSPACE, 2L))
                .thenReturn(Optional.of(member(WorkspaceRole.ROLE_PROJECT_MANAGER)));

        assertThat(boardAccess.canAccessBoard(BOARD, principal(2L, false))).isTrue();
        verifyNoInteractions(boardMemberRepository);
    }

    @Test
    void aDeveloperNeedsABoardMembership() {
        when(boardRepository.findWorkspaceIdById(BOARD)).thenReturn(Optional.of(WORKSPACE));
        when(workspaceMemberRepository.findByWorkspaceIdAndUserId(WORKSPACE, 3L))
                .thenReturn(Optional.of(member(WorkspaceRole.ROLE_DEVELOPER)));
        when(boardMemberRepository.existsByBoardIdAndUserId(BOARD, 3L)).thenReturn(true, false);

        assertThat(boardAccess.roleOnBoard(BOARD, 3L)).contains(WorkspaceRole.ROLE_DEVELOPER);
        assertThat(boardAccess.roleOnBoard(BOARD, 3L)).isEmpty();
    }

    @Test
    void someoneRemovedFromTheWorkspaceOpensNothing() {
        when(boardRepository.findWorkspaceIdById(BOARD)).thenReturn(Optional.of(WORKSPACE));
        when(workspaceMemberRepository.findByWorkspaceIdAndUserId(WORKSPACE, 3L)).thenReturn(Optional.empty());

        assertThat(boardAccess.canAccessBoard(BOARD, principal(3L, false))).isFalse();
    }

    @Test
    void aDevelopersScopeListsOnlyTheirBoards() {
        when(workspaceMemberRepository.findByWorkspaceIdAndUserId(WORKSPACE, 3L))
                .thenReturn(Optional.of(member(WorkspaceRole.ROLE_DEVELOPER)));
        when(boardMemberRepository.findBoardIdsByWorkspaceIdAndUserId(WORKSPACE, 3L)).thenReturn(Set.of(10L));

        BoardScope scope = boardAccess.scopeFor(WORKSPACE, principal(3L, false));

        assertThat(scope.includes(10L)).isTrue();
        assertThat(scope.includes(11L)).isFalse();
    }

    @Test
    void aNonMembersScopeIsEmpty() {
        when(workspaceMemberRepository.findByWorkspaceIdAndUserId(WORKSPACE, 6L)).thenReturn(Optional.empty());

        assertThat(boardAccess.scopeFor(WORKSPACE, principal(6L, false))).isEqualTo(BoardScope.NONE);
    }

    @Test
    void aProposedAssigneeIsCheckedWithTheirOwnAdminFlag() {
        User admin = User.builder().id(1L).email("admin@valeo.com").firstName("A").lastName("B").passwordHash("h").isAdmin(true).build();
        when(userRepository.findById(1L)).thenReturn(Optional.of(admin));

        assertThat(boardAccess.userCanAccessBoard(1L, BOARD)).isTrue();
    }

    private static WorkspaceMember member(WorkspaceRole role) {
        return WorkspaceMember.builder().role(role).build();
    }

    private static CustomUserDetails principal(long id, boolean admin) {
        return new CustomUserDetails(id, "user" + id + "@valeo.com", "hash", "First", "Last", admin, List.of());
    }
}
