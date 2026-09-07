package com.valeo.kanban.model.entity;

import jakarta.persistence.*;
import lombok.*;
import java.time.Instant;
import java.util.ArrayList;
import java.util.Collections;
import java.util.List;

@Entity
@Table(name = "boards")
@Getter
@Setter
@NoArgsConstructor
@AllArgsConstructor
@Builder
@ToString(exclude = "columns")
public class Board {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "workspace_id", nullable = false)
    private Workspace workspace;

    @jakarta.persistence.Column(nullable = false, length = 200)
    private String title;

    @jakarta.persistence.Column(columnDefinition = "TEXT")
    private String description;

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "created_by_id", nullable = false)
    private User createdBy;

    @OneToMany(mappedBy = "board", cascade = CascadeType.ALL, orphanRemoval = true, fetch = FetchType.LAZY)
    @Builder.Default
    @Getter(AccessLevel.NONE)
    @Setter(AccessLevel.NONE)
    private List<Column> columns = new ArrayList<>();

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

    public List<Column> getColumns() {
        return this.columns == null ? Collections.emptyList() : Collections.unmodifiableList(this.columns);
    }

    public void addColumn(Column column) {
        if (column != null) {
            this.columns.add(column);
            column.setBoard(this);
        }
    }

    public void removeColumn(Column column) {
        if (column != null) {
            this.columns.remove(column);
            column.setBoard(null);
        }
    }

    @Override
    public boolean equals(Object o) {
        if (this == o) return true;
        if (!(o instanceof Board)) return false;
        Board board = (Board) o;
        return id != null && id.equals(board.getId());
    }

    @Override
    public int hashCode() {
        return getClass().hashCode();
    }
}
