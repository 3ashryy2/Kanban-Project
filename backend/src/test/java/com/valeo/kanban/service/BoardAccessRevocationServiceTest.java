package com.valeo.kanban.service;

import com.valeo.kanban.event.model.TaskGenericAuditEvent;
import com.valeo.kanban.model.entity.Board;
import com.valeo.kanban.model.entity.Task;
import com.valeo.kanban.model.entity.User;
import com.valeo.kanban.repository.TaskRepository;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.ArgumentCaptor;
import org.mockito.InjectMocks;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import org.springframework.context.ApplicationEventPublisher;
import java.util.List;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.Mockito.times;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.verifyNoInteractions;
import static org.mockito.Mockito.when;

@ExtendWith(MockitoExtension.class)
class BoardAccessRevocationServiceTest {

    @Mock private TaskRepository taskRepository;
    @Mock private ApplicationEventPublisher eventPublisher;

    @InjectMocks private BoardAccessRevocationService revocationService;

    @Test
    void unassignsEveryTaskOnTheLostBoardsAndAuditsEachOne() {
        User dev = User.builder().id(3L).email("dev@valeo.com").firstName("Mohanad").lastName("Emad").passwordHash("hash").build();
        Task first = Task.builder().id(21L).board(Board.builder().id(10L).build()).assignee(dev).build();
        Task second = Task.builder().id(22L).board(Board.builder().id(11L).build()).assignee(dev).build();
        List<Long> lostBoards = List.of(10L, 11L);
        when(taskRepository.findAllAssignedToUserOnBoards(3L, lostBoards)).thenReturn(List.of(first, second));

        int unassigned = revocationService.unassignTasksOnBoards(1L, 3L, lostBoards, 2L);

        assertThat(unassigned).isEqualTo(2);
        assertThat(first.getAssignee()).isNull();
        assertThat(second.getAssignee()).isNull();
        verify(taskRepository).saveAll(List.of(first, second));

        ArgumentCaptor<TaskGenericAuditEvent> events = ArgumentCaptor.forClass(TaskGenericAuditEvent.class);
        verify(eventPublisher, times(2)).publishEvent(events.capture());
        assertThat(events.getAllValues()).extracting(TaskGenericAuditEvent::getActionType).containsOnly("TASK_AUTO_UNASSIGNED");
        assertThat(events.getAllValues()).extracting(TaskGenericAuditEvent::getActorId).containsOnly(2L);
        assertThat(events.getAllValues().get(0).getDetails()).contains("dev@valeo.com");
    }

    @Test
    void losingNoBoardsTouchesNothing() {
        assertThat(revocationService.unassignTasksOnBoards(1L, 3L, List.of(), 2L)).isZero();
        verifyNoInteractions(taskRepository, eventPublisher);
    }
}
