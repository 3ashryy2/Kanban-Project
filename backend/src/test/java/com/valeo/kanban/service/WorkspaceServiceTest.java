package com.valeo.kanban.service;

import com.valeo.kanban.dto.request.WorkspaceCreateRequest;
import com.valeo.kanban.dto.request.WorkspaceMemberCreateRequest;
import com.valeo.kanban.dto.response.WorkspaceResponseDto;
import com.valeo.kanban.exception.custom.ConflictException;
import com.valeo.kanban.model.entity.User;
import com.valeo.kanban.model.entity.Workspace;
import com.valeo.kanban.model.entity.WorkspaceMember;
import com.valeo.kanban.model.enums.WorkspaceRole;
import com.valeo.kanban.repository.BoardRepository;
import com.valeo.kanban.repository.UserRepository;
import com.valeo.kanban.repository.WorkspaceMemberRepository;
import com.valeo.kanban.repository.WorkspaceRepository;
import com.valeo.kanban.security.CustomUserDetails;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.ArgumentCaptor;
import org.mockito.InjectMocks;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import org.springframework.data.domain.Sort;
import java.util.List;
import java.util.Optional;

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

    @InjectMocks private WorkspaceService workspaceService;

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
