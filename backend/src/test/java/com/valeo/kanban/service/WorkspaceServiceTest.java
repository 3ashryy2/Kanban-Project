package com.valeo.kanban.service;

import com.valeo.kanban.dto.request.WorkspaceCreateRequest;
import com.valeo.kanban.dto.request.WorkspaceMemberCreateRequest;
import com.valeo.kanban.dto.request.WorkspaceMemberUpdateRequest;
import com.valeo.kanban.dto.response.MembershipChangeResponseDto;
import com.valeo.kanban.dto.response.WorkspaceResponseDto;
import com.valeo.kanban.exception.custom.ConflictException;
import com.valeo.kanban.model.entity.User;
import com.valeo.kanban.model.entity.Workspace;
import com.valeo.kanban.model.entity.WorkspaceMember;
import com.valeo.kanban.model.enums.WorkspaceRole;
import com.valeo.kanban.repository.BoardMemberRepository;
import com.valeo.kanban.repository.BoardRepository;
import com.valeo.kanban.repository.UserRepository;
import com.valeo.kanban.repository.WorkspaceMemberRepository;
import com.valeo.kanban.repository.WorkspaceRepository;
import com.valeo.kanban.security.BoardAccessService;
import com.valeo.kanban.security.BoardScope;
import com.valeo.kanban.security.CustomUserDetails;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.ArgumentCaptor;
import org.mockito.InjectMocks;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import org.springframework.data.domain.Sort;
import java.util.List;
import java.util.Map;
import java.util.Optional;
import java.util.Set;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.anyList;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

@ExtendWith(MockitoExtension.class)
class WorkspaceServiceTest {

    @Mock private WorkspaceRepository workspaceRepository;
    @Mock private WorkspaceMemberRepository workspaceMemberRepository;
    @Mock private UserRepository userRepository;
    @Mock private BoardRepository boardRepository;
    @Mock private BoardMemberRepository boardMemberRepository;
    @Mock private BoardAccessService boardAccessService;
    @Mock private BoardMembershipService boardMembershipService;
    @Mock private BoardAccessRevocationService revocationService;

    @InjectMocks private WorkspaceService workspaceService;

    @Test
    void removingADeveloperUnassignsTheirTasksOnTheirBoardsBeforeDeletingTheMembership() {
        WorkspaceMember dev = membership(workspace(1L, "Alpha"), user(3L), WorkspaceRole.ROLE_DEVELOPER);
        when(workspaceMemberRepository.findByWorkspaceIdAndUserId(1L, 3L)).thenReturn(Optional.of(dev));
        when(boardMemberRepository.findBoardIdsByWorkspaceIdAndUserId(1L, 3L)).thenReturn(Set.of(10L));
        when(revocationService.unassignTasksOnBoards(1L, 3L, Set.of(10L), 2L)).thenReturn(4);

        MembershipChangeResponseDto result = workspaceService.removeWorkspaceMember(1L, 3L, principal(2L, false));

        assertThat(result.getUnassignedTaskCount()).isEqualTo(4);
        assertThat(result.getMember()).isNull();
        verify(workspaceMemberRepository).delete(dev);
    }

    @Test
    void demotingAPmUnassignsTasksOnlyOnBoardsTheyAreNotAnExplicitMemberOf() {
        WorkspaceMember pm = membership(workspace(1L, "Alpha"), user(2L), WorkspaceRole.ROLE_PROJECT_MANAGER);
        when(workspaceMemberRepository.findByWorkspaceIdAndUserId(1L, 2L)).thenReturn(Optional.of(pm));
        when(workspaceMemberRepository.save(pm)).thenReturn(pm);
        when(boardMemberRepository.findBoardIdsByWorkspaceIdAndUserId(1L, 2L)).thenReturn(Set.of(10L)); // a board they created
        when(boardRepository.findIdsByWorkspaceId(1L)).thenReturn(List.of(10L, 11L));
        when(revocationService.unassignTasksOnBoards(1L, 2L, List.of(11L), 1L)).thenReturn(1);
        when(boardMembershipService.boardsByUser(1L, BoardScope.ALL)).thenReturn(Map.of());

        MembershipChangeResponseDto result = workspaceService.updateWorkspaceMemberRole(
                1L, 2L, new WorkspaceMemberUpdateRequest("ROLE_DEVELOPER"), principal(1L, true));

        assertThat(result.getUnassignedTaskCount()).isEqualTo(1);
        assertThat(result.getMember().getRole()).isEqualTo("ROLE_DEVELOPER");
        assertThat(result.getMember().isAllBoards()).isFalse();
    }

    @Test
    void adminSeesEveryWorkspaceWithNullRoleWhereNotAMember() {
        Workspace alpha = workspace(1L, "Alpha");
        Workspace beta = workspace(2L, "Beta");
        when(workspaceMemberRepository.findAllByUserIdWithWorkspace(1L))
                .thenReturn(List.of(membership(beta, user(1L), WorkspaceRole.ROLE_PROJECT_MANAGER)));
        when(workspaceRepository.findAll(any(Sort.class))).thenReturn(List.of(alpha, beta));
        stubEmptyCounts();

        List<WorkspaceResponseDto> result = workspaceService.getUserWorkspaces(principal(1L, true));

        assertThat(result).extracting(WorkspaceResponseDto::getId).containsExactly(1L, 2L);
        assertThat(result.get(0).getCurrentUserRole()).isNull();
        assertThat(result.get(1).getCurrentUserRole()).isEqualTo("ROLE_PROJECT_MANAGER");
    }

    @Test
    void memberSeesOnlyTheirOwnWorkspaces() {
        Workspace beta = workspace(2L, "Beta");
        when(workspaceMemberRepository.findAllByUserIdWithWorkspace(3L))
                .thenReturn(List.of(membership(beta, user(3L), WorkspaceRole.ROLE_DEVELOPER)));
        stubEmptyCounts();

        List<WorkspaceResponseDto> result = workspaceService.getUserWorkspaces(principal(3L, false));

        assertThat(result).extracting(WorkspaceResponseDto::getId).containsExactly(2L);
        assertThat(result.get(0).getCurrentUserRole()).isEqualTo("ROLE_DEVELOPER");
        verify(workspaceRepository, never()).findAll(any(Sort.class));
    }

    @Test
    void userWithoutMembershipsGetsAnEmptyList() {
        when(workspaceMemberRepository.findAllByUserIdWithWorkspace(6L)).thenReturn(List.of());

        assertThat(workspaceService.getUserWorkspaces(principal(6L, false))).isEmpty();
    }

    @Test
    void addingAnExistingMemberIsAConflict() {
        when(workspaceRepository.findById(1L)).thenReturn(Optional.of(workspace(1L, "Alpha")));
        when(userRepository.findById(3L)).thenReturn(Optional.of(user(3L)));
        when(workspaceMemberRepository.existsByWorkspaceIdAndUserId(1L, 3L)).thenReturn(true);

        assertThatThrownBy(() -> workspaceService.addWorkspaceMember(1L, new WorkspaceMemberCreateRequest(3L, "ROLE_DEVELOPER")))
                .isInstanceOf(ConflictException.class);
        verify(workspaceMemberRepository, never()).save(any());
    }

    @Test
    void addingWithAnUnknownRoleIsABadRequest() {
        when(workspaceRepository.findById(1L)).thenReturn(Optional.of(workspace(1L, "Alpha")));
        when(userRepository.findById(3L)).thenReturn(Optional.of(user(3L)));

        assertThatThrownBy(() -> workspaceService.addWorkspaceMember(1L, new WorkspaceMemberCreateRequest(3L, "ROLE_BOSS")))
                .isInstanceOf(IllegalArgumentException.class)
                .hasMessageContaining("Invalid workspace role");
    }

    @Test
    void creatingAWorkspaceDoesNotEnrolTheAdmin() {
        when(workspaceRepository.findBySlug("alpha")).thenReturn(Optional.empty());
        when(userRepository.getReferenceById(1L)).thenReturn(user(1L));
        when(workspaceRepository.save(any(Workspace.class))).thenAnswer(inv -> withId(inv.getArgument(0), 10L));

        WorkspaceResponseDto result = workspaceService.createWorkspace(createRequest("alpha", null), principal(1L, true));

        assertThat(result.getCurrentUserRole()).isNull();
        assertThat(result.getMemberCount()).isZero();
        verify(workspaceMemberRepository, never()).save(any());
    }

    @Test
    void creatingAWorkspaceWithAnInitialManagerEnrolsThemAsPm() {
        when(workspaceRepository.findBySlug("alpha")).thenReturn(Optional.empty());
        when(userRepository.getReferenceById(1L)).thenReturn(user(1L));
        when(workspaceRepository.save(any(Workspace.class))).thenAnswer(inv -> withId(inv.getArgument(0), 10L));
        when(userRepository.findById(2L)).thenReturn(Optional.of(user(2L)));

        WorkspaceResponseDto result = workspaceService.createWorkspace(createRequest("alpha", 2L), principal(1L, true));

        ArgumentCaptor<WorkspaceMember> saved = ArgumentCaptor.forClass(WorkspaceMember.class);
        verify(workspaceMemberRepository).save(saved.capture());
        assertThat(saved.getValue().getUser().getId()).isEqualTo(2L);
        assertThat(saved.getValue().getRole()).isEqualTo(WorkspaceRole.ROLE_PROJECT_MANAGER);
        assertThat(result.getMemberCount()).isEqualTo(1);
    }

    @Test
    void aDuplicateSlugIsAConflict() {
        when(workspaceRepository.findBySlug("alpha")).thenReturn(Optional.of(workspace(1L, "Alpha")));

        assertThatThrownBy(() -> workspaceService.createWorkspace(createRequest("alpha", null), principal(1L, true)))
                .isInstanceOf(ConflictException.class);
        verify(workspaceRepository, never()).save(any());
    }

    private void stubEmptyCounts() {
        when(boardRepository.countByWorkspaceIds(anyList())).thenReturn(List.of());
        when(workspaceMemberRepository.countByWorkspaceIds(anyList())).thenReturn(List.of());
    }

    private static CustomUserDetails principal(long id, boolean admin) {
        return new CustomUserDetails(id, "user" + id + "@valeo.com", "hash", "First", "Last", admin, List.of());
    }

    private static User user(long id) {
        return User.builder().id(id).email("user" + id + "@valeo.com").firstName("First").lastName("Last").passwordHash("hash").build();
    }

    private static Workspace workspace(long id, String name) {
        return Workspace.builder().id(id).name(name).slug(name.toLowerCase()).build();
    }

    private static WorkspaceMember membership(Workspace workspace, User user, WorkspaceRole role) {
        return WorkspaceMember.builder().workspace(workspace).user(user).role(role).build();
    }

    private static WorkspaceCreateRequest createRequest(String slug, Long initialManagerId) {
        return new WorkspaceCreateRequest("Alpha", slug, "desc", initialManagerId);
    }

    private static Workspace withId(Workspace workspace, long id) {
        workspace.setId(id);
        return workspace;
    }
}
