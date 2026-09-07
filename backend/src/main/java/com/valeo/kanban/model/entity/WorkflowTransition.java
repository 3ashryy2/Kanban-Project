package com.valeo.kanban.model.entity;

import jakarta.persistence.*;
import lombok.*;

@Entity
@Table(name = "workflow_transitions", uniqueConstraints = {
    @UniqueConstraint(name = "uk_board_transition", columnNames = {"board_id", "from_column_id", "to_column_id"})
})
@Getter
@Setter
@NoArgsConstructor
@AllArgsConstructor
@Builder
@ToString(exclude = {"board", "fromColumn", "toColumn", "fallbackColumn"})
public class WorkflowTransition {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "board_id", nullable = false)
    private Board board;

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "from_column_id", nullable = false)
    private Column fromColumn;

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "to_column_id", nullable = false)
    private Column toColumn;

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "fallback_column_id")
    private Column fallbackColumn;

    @jakarta.persistence.Column(name = "requires_approval", nullable = false)
    @Builder.Default
    private boolean requiresApproval = false;

    @Override
    public boolean equals(Object o) {
        if (this == o) return true;
        if (!(o instanceof WorkflowTransition)) return false;
        WorkflowTransition that = (WorkflowTransition) o;
        return id != null && id.equals(that.getId());
    }

    @Override
    public int hashCode() {
        return getClass().hashCode();
    }
}
