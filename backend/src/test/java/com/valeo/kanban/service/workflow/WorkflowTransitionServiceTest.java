package com.valeo.kanban.service.workflow;

import com.valeo.kanban.dto.request.WorkflowTransitionUpdateRequest;
import com.valeo.kanban.exception.custom.InvalidStateTransitionException;
import com.valeo.kanban.model.entity.Board;
import com.valeo.kanban.model.entity.Column;
import com.valeo.kanban.model.entity.WorkflowTransition;
import com.valeo.kanban.repository.BoardRepository;
import com.valeo.kanban.repository.ColumnRepository;
import com.valeo.kanban.repository.WorkflowTransitionRepository;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.ArgumentCaptor;
import org.mockito.ArgumentMatchers;
import org.mockito.InjectMocks;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import java.util.List;
import java.util.Map;
import java.util.Optional;
import java.util.function.Function;
import java.util.stream.Collectors;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.assertj.core.api.Assertions.tuple;
import static org.mockito.ArgumentMatchers.anyLong;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.verifyNoInteractions;
import static org.mockito.Mockito.when;

@ExtendWith(MockitoExtension.class)
class WorkflowTransitionServiceTest {

    @Mock private WorkflowTransitionRepository transitionRepository;
    @Mock private BoardRepository boardRepository;
    @Mock private ColumnRepository columnRepository;

    @InjectMocks private WorkflowTransitionService workflowTransitionService;

    private final Board board = Board.builder().id(10L).build();
    private final Column todo = column(1L, "To-Do");
    private final Column inProgress = column(2L, "In Progress");
    private final Column codeReview = column(3L, "Code Review");
    private final Column readyForQa = column(4L, "Ready for QA");
    private final Column done = column(5L, "Done");

    @Test
    void aNewBoardGetsTheDefaultRulesAndItsGatedColumnsAreMarked() {
        List<Column> columns = List.of(todo, inProgress, codeReview, readyForQa, done);
        when(transitionRepository.saveAll(ArgumentMatchers.<WorkflowTransition>anyList()))
                .thenAnswer(invocation -> invocation.getArgument(0));

        workflowTransitionService.applyDefaultWorkflow(board, columns);

        @SuppressWarnings("unchecked")
        ArgumentCaptor<List<WorkflowTransition>> saved = ArgumentCaptor.forClass(List.class);
        verify(transitionRepository).saveAll(saved.capture());
        assertThat(saved.getValue())
                .extracting(t -> t.getFromColumn().getName() + " -> " + t.getToColumn().getName(),
                        WorkflowTransition::isRequiresApproval)
                .containsExactly(
                        tuple("To-Do -> In Progress", false),
                        tuple("In Progress -> Code Review", false),
                        tuple("Code Review -> Ready for QA", true),
                        tuple("Ready for QA -> Done", true),
                        tuple("Ready for QA -> In Progress", false));
        // Gated exactly where a rule into the column requires approval
        assertThat(columns).extracting(Column::getName, Column::isGated).containsExactly(
                tuple("To-Do", false),
                tuple("In Progress", false),
                tuple("Code Review", false),
                tuple("Ready for QA", true),
                tuple("Done", true));
    }

    @Test
    void savingRulesRecomputesGatedColumnsAndDropsFallbacksFromUngatedRules() {
        List<Column> columns = List.of(todo, inProgress, codeReview, done);
        codeReview.setGated(true); // stale: no rule into Code Review requires approval any more
        stubBoard(columns);
        when(transitionRepository.findAllByBoardId(10L)).thenReturn(List.of());
        when(transitionRepository.saveAll(ArgumentMatchers.<WorkflowTransition>anyList()))
                .thenAnswer(invocation -> invocation.getArgument(0));

        List<WorkflowTransitionUpdateRequest> saved = workflowTransitionService.updateTransitions(10L, List.of(
                new WorkflowTransitionUpdateRequest(1L, 2L, 1L, false), // a fallback on a rule without approval means nothing
                new WorkflowTransitionUpdateRequest(2L, 5L, 2L, true)));

        assertThat(saved).extracting(WorkflowTransitionUpdateRequest::getFallbackColumnId).containsExactly(null, 2L);
        assertThat(columns).extracting(Column::isGated).containsExactly(false, false, false, true);
    }

    @Test
    void aRuleThatRequiresApprovalMustNameAFallback() {
        stubBoardColumns(List.of(codeReview, readyForQa));

        assertThatThrownBy(() -> workflowTransitionService.updateTransitions(10L, List.of(
                new WorkflowTransitionUpdateRequest(3L, 4L, null, true))))
                .isInstanceOf(InvalidStateTransitionException.class)
                .hasMessageContaining("Code Review -> Ready for QA");
        verifyNoInteractions(transitionRepository);
    }

    @Test
    void aGateCannotFallBackToItsOwnTarget() {
        stubBoardColumns(List.of(codeReview, readyForQa));

        assertThatThrownBy(() -> workflowTransitionService.updateTransitions(10L, List.of(
                new WorkflowTransitionUpdateRequest(3L, 4L, 4L, true))))
                .isInstanceOf(InvalidStateTransitionException.class)
                .hasMessageContaining("own target");
        verifyNoInteractions(transitionRepository);
    }

    private void stubBoardColumns(List<Column> columns) {
        when(boardRepository.findById(10L)).thenReturn(Optional.of(board));
        when(columnRepository.findAllByBoardIdOrderByPositionAsc(10L)).thenReturn(columns);
    }

    private void stubBoard(List<Column> columns) {
        stubBoardColumns(columns);
        Map<Long, Column> byId = columns.stream().collect(Collectors.toMap(Column::getId, Function.identity()));
        when(columnRepository.getReferenceById(anyLong())).thenAnswer(invocation -> byId.get(invocation.<Long>getArgument(0)));
    }

    private static Column column(long id, String name) {
        return Column.builder().id(id).name(name).build();
    }
}
