package com.valeo.kanban.model.entity;

import jakarta.persistence.*;
import lombok.*;
import java.time.Instant;

@Entity
@Table(name = "audit_logs")
@Getter
@Setter
@NoArgsConstructor
@AllArgsConstructor
@Builder
@ToString(exclude = "actor")
public class AuditLog {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @jakarta.persistence.Column(name = "workspace_id", nullable = false)
    private Long workspaceId;

    @jakarta.persistence.Column(name = "board_id", nullable = false)
    private Long boardId;

    @jakarta.persistence.Column(name = "task_id", nullable = false)
    private Long taskId;

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "actor_id", nullable = false)
    private User actor;

    @jakarta.persistence.Column(name = "action_type", nullable = false, length = 50)
    private String actionType;

    @jakarta.persistence.Column(name = "source_column_id")
    private Long sourceColumnId;

    @jakarta.persistence.Column(name = "target_column_id")
    private Long targetColumnId;

    @jakarta.persistence.Column(columnDefinition = "TEXT")
    private String details;

    @jakarta.persistence.Column(nullable = false, updatable = false)
    @Builder.Default
    private Instant timestamp = Instant.now();

    @PrePersist
    protected void onCreate() {
        if (this.timestamp == null) {
            this.timestamp = Instant.now();
        }
    }

    @Override
    public boolean equals(Object o) {
        if (this == o) return true;
        if (!(o instanceof AuditLog)) return false;
        AuditLog that = (AuditLog) o;
        return id != null && id.equals(that.getId());
    }

    @Override
    public int hashCode() {
        return getClass().hashCode();
    }
}
