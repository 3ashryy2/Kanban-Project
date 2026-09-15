package com.example.kanban.security.evaluator;

import com.example.kanban.model.entity.Column;
import com.example.kanban.model.enums.WorkspaceRole;
import com.example.kanban.repository.BoardRepository;
import com.example.kanban.repository.ColumnRepository;
import com.example.kanban.repository.TaskRepository;
import com.example.kanban.repository.WorkspaceMemberRepository;
import com.example.kanban.security.BoardAccessService;
import com.example.kanban.security.CustomUserDetails;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.InjectMocks;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import java.util.List;
import java.util.Optional;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.Mockito.verifyNoInteractions;
import static org.mockito.Mockito.when;

@ExtendWith(MockitoExtension.class)
class BoardSecurityEvaluatorTest {

    @Mock private BoardRepository boardRepository;
    @Mock private TaskRepository taskRepository;
    @Mock private ColumnRepository columnRepository;
    @Mock private WorkspaceMemberRepository workspaceMemberRepository;
    @Mock private WorkspaceSecurityEvaluator workspaceSecurity;
    @Mock private BoardAccessService boardAccess;

    @InjectMocks private BoardSecurityEvaluator boardSecurity;

    private final CustomUserDetails developer = user(3L, "dev@example.com");
    private final CustomUserDetails projectManager = user(2L, "pm@example.com");
    private final CustomUserDetails viewer = user(5L, "viewer@example.com");

    @Test
    void developersCreateCardsOnlyInTheFirstColumn() {
        when(boardAccess.roleOnBoard(10L, 3L)).thenReturn(Optional.of(WorkspaceRole.ROLE_DEVELOPER));
        when(columnRepository.findFirstByBoardIdOrderByPositionAsc(10L))
                .thenReturn(Optional.of(Column.builder().id(1L).name("To-Do").build()));

        assertThat(boardSecurity.canCreateTaskInColumn(10L, 1L, null, developer)).isTrue();
        // e.g. straight into "Ready for QA", which would skip the approval gate
        assertThat(boardSecurity.canCreateTaskInColumn(10L, 4L, null, developer)).isFalse();
    }

    @Test
    void developersPutOnlyThemselvesOnANewCard() {
        when(boardAccess.roleOnBoard(10L, 3L)).thenReturn(Optional.of(WorkspaceRole.ROLE_DEVELOPER));
        when(columnRepository.findFirstByBoardIdOrderByPositionAsc(10L))
                .thenReturn(Optional.of(Column.builder().id(1L).name("To-Do").build()));

        assertThat(boardSecurity.canCreateTaskInColumn(10L, 1L, 3L, developer)).isTrue();
        assertThat(boardSecurity.canCreateTaskInColumn(10L, 1L, 4L, developer)).isFalse();
    }

    @Test
    void projectManagersCreateCardsInAnyColumnForAnyone() {
        when(boardAccess.roleOnBoard(10L, 2L)).thenReturn(Optional.of(WorkspaceRole.ROLE_PROJECT_MANAGER));

        assertThat(boardSecurity.canCreateTaskInColumn(10L, 4L, 3L, projectManager)).isTrue();
        verifyNoInteractions(columnRepository);
    }

    @Test
    void viewersCannotCreateCardsAnywhere() {
        when(boardAccess.roleOnBoard(10L, 5L)).thenReturn(Optional.of(WorkspaceRole.ROLE_VIEWER));

        assertThat(boardSecurity.canCreateTaskInColumn(10L, 1L, null, viewer)).isFalse();
    }

    @Test
    void canApproveTask_QAGate_PM_Admin_QATester_Allowed() {
        com.example.kanban.model.entity.Task mockTask = org.mockito.Mockito.mock(com.example.kanban.model.entity.Task.class);
        com.example.kanban.model.entity.Board mockBoard = org.mockito.Mockito.mock(com.example.kanban.model.entity.Board.class);
        com.example.kanban.model.entity.Workspace mockWorkspace = org.mockito.Mockito.mock(com.example.kanban.model.entity.Workspace.class);
        com.example.kanban.model.entity.Column mockColumn = org.mockito.Mockito.mock(com.example.kanban.model.entity.Column.class);
        com.example.kanban.model.entity.WorkspaceMember mockMemberQA = org.mockito.Mockito.mock(com.example.kanban.model.entity.WorkspaceMember.class);
        com.example.kanban.model.entity.WorkspaceMember mockMemberPM = org.mockito.Mockito.mock(com.example.kanban.model.entity.WorkspaceMember.class);

        when(mockTask.getColumn()).thenReturn(mockColumn);
        when(mockTask.getBoard()).thenReturn(mockBoard);
        when(mockBoard.getWorkspace()).thenReturn(mockWorkspace);
        when(mockWorkspace.getId()).thenReturn(100L);
        when(mockColumn.getName()).thenReturn("Ready for QA");

        when(taskRepository.findByIdWithHierarchy(1L)).thenReturn(Optional.of(mockTask));

        CustomUserDetails qaTester = user(4L, "qa@example.com");
        when(mockMemberQA.getRole()).thenReturn(WorkspaceRole.ROLE_QA_TESTER);
        when(workspaceMemberRepository.findByWorkspaceIdAndUserId(100L, 4L)).thenReturn(Optional.of(mockMemberQA));

        when(mockMemberPM.getRole()).thenReturn(WorkspaceRole.ROLE_PROJECT_MANAGER);
        when(workspaceMemberRepository.findByWorkspaceIdAndUserId(100L, projectManager.getId())).thenReturn(Optional.of(mockMemberPM));

        CustomUserDetails admin = new CustomUserDetails(99L, "admin@example.com", "hash", "Admin", "User", true, List.of());

        assertThat(boardSecurity.canApproveTask(1L, qaTester)).isTrue();
        assertThat(boardSecurity.canApproveTask(1L, projectManager)).isTrue();
        assertThat(boardSecurity.canApproveTask(1L, admin)).isTrue();

        when(workspaceMemberRepository.findByWorkspaceIdAndUserId(100L, developer.getId())).thenReturn(Optional.empty());
        assertThat(boardSecurity.canApproveTask(1L, developer)).isFalse();
    }

    @Test
    void canApproveTask_DoneGate_OnlyPM_Admin_Allowed() {
        com.example.kanban.model.entity.Task mockTask = org.mockito.Mockito.mock(com.example.kanban.model.entity.Task.class);
        com.example.kanban.model.entity.Board mockBoard = org.mockito.Mockito.mock(com.example.kanban.model.entity.Board.class);
        com.example.kanban.model.entity.Workspace mockWorkspace = org.mockito.Mockito.mock(com.example.kanban.model.entity.Workspace.class);
        com.example.kanban.model.entity.Column mockColumn = org.mockito.Mockito.mock(com.example.kanban.model.entity.Column.class);
        com.example.kanban.model.entity.WorkspaceMember mockMemberQA = org.mockito.Mockito.mock(com.example.kanban.model.entity.WorkspaceMember.class);
        com.example.kanban.model.entity.WorkspaceMember mockMemberPM = org.mockito.Mockito.mock(com.example.kanban.model.entity.WorkspaceMember.class);

        when(mockTask.getColumn()).thenReturn(mockColumn);
        when(mockTask.getBoard()).thenReturn(mockBoard);
        when(mockBoard.getWorkspace()).thenReturn(mockWorkspace);
        when(mockWorkspace.getId()).thenReturn(100L);
        when(mockColumn.getName()).thenReturn("Done");

        when(taskRepository.findByIdWithHierarchy(1L)).thenReturn(Optional.of(mockTask));

        CustomUserDetails qaTester = user(4L, "qa@example.com");
        when(mockMemberQA.getRole()).thenReturn(WorkspaceRole.ROLE_QA_TESTER);
        when(workspaceMemberRepository.findByWorkspaceIdAndUserId(100L, 4L)).thenReturn(Optional.of(mockMemberQA));

        when(mockMemberPM.getRole()).thenReturn(WorkspaceRole.ROLE_PROJECT_MANAGER);
        when(workspaceMemberRepository.findByWorkspaceIdAndUserId(100L, projectManager.getId())).thenReturn(Optional.of(mockMemberPM));

        CustomUserDetails admin = new CustomUserDetails(99L, "admin@example.com", "hash", "Admin", "User", true, List.of());

        assertThat(boardSecurity.canApproveTask(1L, qaTester)).isFalse();
        assertThat(boardSecurity.canApproveTask(1L, projectManager)).isTrue();
        assertThat(boardSecurity.canApproveTask(1L, admin)).isTrue();
    }

    private static CustomUserDetails user(long id, String email) {
        return new CustomUserDetails(id, email, "hash", "First", "Last", false, List.of());
    }
}
