package com.valeo.kanban.service;

import com.valeo.kanban.dto.response.MembershipChangeResponseDto;
import com.valeo.kanban.model.entity.Board;
import com.valeo.kanban.model.entity.BoardMember;
import com.valeo.kanban.model.entity.User;
import com.valeo.kanban.model.entity.Workspace;
import com.valeo.kanban.model.entity.WorkspaceMember;
import com.valeo.kanban.model.enums.WorkspaceRole;
import com.valeo.kanban.repository.BoardMemberRepository;
import com.valeo.kanban.repository.BoardRepository;
import com.valeo.kanban.repository.UserRepository;
import com.valeo.kanban.repository.WorkspaceMemberRepository;
import com.valeo.kanban.security.CustomUserDetails;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.ArgumentCaptor;
import org.mockito.InjectMocks;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import java.util.List;
import java.util.Optional;
import java.util.Set;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.verifyNoInteractions;
import static org.mockito.Mockito.when;

@ExtendWith(MockitoExtension.class)
class BoardMembershipServiceTest {

    @Mock private BoardMemberRepository boardMemberRepository;
    @Mock private BoardRepository boardRepository;
    @Mock private WorkspaceMemberRepository workspaceMemberRepository;
    @Mock private UserRepository userRepository;
    @Mock private BoardAccessRevocationService revocationService;

    @InjectMocks private BoardMembershipService boardMembershipService;

    private final CustomUserDetails admin = new CustomUserDetails(1L, "admin@valeo.com", "hash", "Admin", "User", true, List.of());

    @Test
    void projectManagersCannotBeGivenExplicitBoards() {
        when(workspaceMemberRepository.findByWorkspaceIdAndUserId(1L, 2L))
                .thenReturn(Optional.of(member(2L, WorkspaceRole.ROLE_PROJECT_MANAGER)));

        assertThatThrownBy(() -> boardMembershipService.setMemberBoards(1L, 2L, List.of(10L), admin))
                .isInstanceOf(IllegalArgumentException.class);
    }

    @Test
    void boardsFromAnotherWorkspaceAreRejectedBeforeAnythingChanges() {
        when(workspaceMemberRepository.findByWorkspaceIdAndUserId(1L, 3L))
                .thenReturn(Optional.of(member(3L, WorkspaceRole.ROLE_DEVELOPER)));
        when(boardRepository.findIdsByWorkspaceId(1L)).thenReturn(List.of(10L, 11L));

        assertThatThrownBy(() -> boardMembershipService.setMemberBoards(1L, 3L, List.of(10L, 99L), admin))
                .isInstanceOf(IllegalArgumentException.class);
        verifyNoInteractions(revocationService);
    }

    @Test
    void replacingBoardsAddsNewOnesAndRevokesTheRemovedOnes() {
        when(workspaceMemberRepository.findByWorkspaceIdAndUserId(1L, 3L))
                .thenReturn(Optional.of(member(3L, WorkspaceRole.ROLE_DEVELOPER)));
        when(boardRepository.findIdsByWorkspaceId(1L)).thenReturn(List.of(10L, 11L, 12L));
        when(boardMemberRepository.findBoardIdsByWorkspaceIdAndUserId(1L, 3L)).thenReturn(Set.of(10L, 11L));
        when(revocationService.unassignTasksOnBoards(1L, 3L, Set.of(11L), 1L)).thenReturn(2);
        when(userRepository.getReferenceById(1L)).thenReturn(User.builder().id(1L).build());
        when(boardRepository.getReferenceById(12L)).thenReturn(Board.builder().id(12L).build());
        when(boardMemberRepository.findAllByWorkspaceIdWithBoard(1L)).thenReturn(List.of());

        // Keep board 10, drop board 11, add board 12
        MembershipChangeResponseDto result = boardMembershipService.setMemberBoards(1L, 3L, List.of(10L, 12L), admin);

        verify(boardMemberRepository).deleteByUserIdAndBoardIdIn(3L, Set.of(11L));
        @SuppressWarnings("unchecked")
        ArgumentCaptor<Iterable<BoardMember>> saved = ArgumentCaptor.forClass(Iterable.class);
        verify(boardMemberRepository).saveAll(saved.capture());
        assertThat(saved.getValue()).extracting(bm -> bm.getBoard().getId()).containsExactly(12L);
        assertThat(result.getUnassignedTaskCount()).isEqualTo(2);
    }

    private static WorkspaceMember member(long userId, WorkspaceRole role) {
        User user = User.builder().id(userId).email("user" + userId + "@valeo.com").firstName("First").lastName("Last").passwordHash("hash").build();
        return WorkspaceMember.builder()
                .workspace(Workspace.builder().id(1L).name("Alpha").slug("alpha").build())
                .user(user)
                .role(role)
                .build();
    }
}
