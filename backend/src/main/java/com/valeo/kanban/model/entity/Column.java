package com.valeo.kanban.model.entity;

import jakarta.persistence.*;
import lombok.*;
import java.time.Instant;
import java.util.ArrayList;
import java.util.Collections;
import java.util.List;

@Entity
@Table(name = "columns")
@Getter
@Setter
@NoArgsConstructor
@AllArgsConstructor
@Builder
@ToString(exclude = {"board", "tasks"})
public class Column {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "board_id", nullable = false)
    private Board board;

    @jakarta.persistence.Column(nullable = false, length = 100)
    private String name;

    @jakarta.persistence.Column(nullable = false)
    private double position;

    @jakarta.persistence.Column(name = "is_gated", nullable = false)
    @Builder.Default
    private boolean isGated = false;

    @jakarta.persistence.Column(name = "wip_limit")
    private Integer wipLimit;

    @OneToMany(mappedBy = "column", cascade = CascadeType.ALL, orphanRemoval = true, fetch = FetchType.LAZY)
    @Builder.Default
    @Getter(AccessLevel.NONE)
    @Setter(AccessLevel.NONE)
    private List<Task> tasks = new ArrayList<>();

    @jakarta.persistence.Column(name = "created_at", nullable = false, updatable = false)
    private Instant createdAt;

    @PrePersist
    protected void onCreate() {
        if (this.createdAt == null) {
            this.createdAt = Instant.now();
        }
    }

    // Secondary constructor to bind easily by id in state transformations
    public Column(Long id) {
        this.id = id;
    }

    public List<Task> getTasks() {
        return this.tasks == null ? Collections.emptyList() : Collections.unmodifiableList(this.tasks);
    }

    public void addTask(Task task) {
        if (task != null) {
            this.tasks.add(task);
            task.setColumn(this);
        }
    }

    public void removeTask(Task task) {
        if (task != null) {
            this.tasks.remove(task);
            task.setColumn(null);
        }
    }

    @Override
    public boolean equals(Object o) {
        if (this == o) return true;
        if (!(o instanceof Column)) return false;
        Column column = (Column) o;
        return id != null && id.equals(column.getId());
    }

    @Override
    public int hashCode() {
        return getClass().hashCode();
    }
}
