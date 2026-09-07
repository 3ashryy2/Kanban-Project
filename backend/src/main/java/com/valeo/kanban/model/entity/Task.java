package com.valeo.kanban.model.entity;

import com.valeo.kanban.model.enums.TaskPriority;
import com.valeo.kanban.model.enums.TaskStatus;
import jakarta.persistence.*;
import lombok.*;
import java.time.Instant;
import java.util.List;
import java.util.ArrayList;

@Entity
@Table(name = "tasks")
@Getter
@Setter
@NoArgsConstructor
@AllArgsConstructor
@Builder
@ToString(exclude = {"board", "column"})
public class Task {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "board_id", nullable = false)
    private Board board;

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "column_id", nullable = false)
    private Column column;

    @jakarta.persistence.Column(nullable = false)
    private String title;

    @jakarta.persistence.Column(columnDefinition = "TEXT")
    private String description;

    @Enumerated(EnumType.STRING)
    @jakarta.persistence.Column(nullable = false, length = 20)
    @Builder.Default
    private TaskPriority priority = TaskPriority.MEDIUM;

    @Enumerated(EnumType.STRING)
    @jakarta.persistence.Column(nullable = false, length = 30)
    @Builder.Default
    private TaskStatus status = TaskStatus.ACTIVE;

    @jakarta.persistence.Column(nullable = false)
    private double position;

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "assignee_id")
    private User assignee;

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "created_by_id", nullable = false)
    private User createdBy;

    @jakarta.persistence.Column(name = "due_date")
    private Instant dueDate;

    @ElementCollection(fetch = FetchType.LAZY)
    @CollectionTable(name = "task_tags", joinColumns = @JoinColumn(name = "task_id"))
    @jakarta.persistence.Column(name = "tag")
    @Builder.Default
    private List<String> tags = new ArrayList<>();

    @jakarta.persistence.Column(name = "rejection_reason", columnDefinition = "TEXT")
    private String rejectionReason;

    @Version
    @jakarta.persistence.Column(nullable = false)
    @Builder.Default
    private Long version = 0L;

    @jakarta.persistence.Column(name = "created_at", nullable = false, updatable = false)
    private Instant createdAt;

    @jakarta.persistence.Column(name = "updated_at", nullable = false)
    private Instant updatedAt;

    @PrePersist
    protected void onCreate() {
        Instant now = Instant.now();
        if (this.createdAt == null) {
            this.createdAt = now;
        }
        if (this.updatedAt == null) {
            this.updatedAt = now;
        }
    }

    @PreUpdate
    protected void onUpdate() {
        this.updatedAt = Instant.now();
    }

    @Override
    public boolean equals(Object o) {
        if (this == o) return true;
        if (!(o instanceof Task)) return false;
        Task task = (Task) o;
        return id != null && id.equals(task.getId());
    }

    @Override
    public int hashCode() {
        return getClass().hashCode();
    }
}
