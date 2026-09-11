package com.valeo.kanban.model.entity;

import jakarta.persistence.*;
import lombok.*;
import java.time.Instant;

@Entity
@Table(name = "board_members", uniqueConstraints = {
    @UniqueConstraint(name = "uk_board_member", columnNames = {"board_id", "user_id"})
})
@Getter
@Setter
@NoArgsConstructor
@AllArgsConstructor
@Builder
public class BoardMember {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "board_id", nullable = false)
    private Board board;

    // Stored alongside the board so the database can tie this row to the user's workspace membership
    @jakarta.persistence.Column(name = "workspace_id", nullable = false)
    private Long workspaceId;

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "user_id", nullable = false)
    private User user;

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "added_by_id")
    private User addedBy;

    @jakarta.persistence.Column(name = "added_at", nullable = false, updatable = false)
    private Instant addedAt;

    @PrePersist
    protected void onCreate() {
        if (this.addedAt == null) {
            this.addedAt = Instant.now();
        }
    }

    @Override
    public boolean equals(Object o) {
        if (this == o) return true;
        if (!(o instanceof BoardMember)) return false;
        BoardMember that = (BoardMember) o;
        return id != null && id.equals(that.getId());
    }

    @Override
    public int hashCode() {
        return getClass().hashCode();
    }
}
