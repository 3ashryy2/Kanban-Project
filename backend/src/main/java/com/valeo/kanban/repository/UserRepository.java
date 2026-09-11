package com.valeo.kanban.repository;

import com.valeo.kanban.model.entity.User;
import org.springframework.data.domain.Pageable;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;
import org.springframework.stereotype.Repository;
import java.util.List;
import java.util.Optional;

@Repository
public interface UserRepository extends JpaRepository<User, Long> {
    Optional<User> findByEmail(String email);

    // Patterns are pre-escaped with '!' by the caller; global admins are never offered as members
    @Query("SELECT u FROM User u WHERE u.isAdmin = false " +
           "AND (LOWER(u.email) LIKE :pattern ESCAPE '!' " +
           "OR LOWER(CONCAT(u.firstName, ' ', u.lastName)) LIKE :pattern ESCAPE '!') " +
           "ORDER BY u.firstName, u.lastName")
    List<User> searchByNameOrEmail(@Param("pattern") String pattern, Pageable pageable);

    @Query("SELECT u FROM User u WHERE u.isAdmin = false " +
           "AND (LOWER(u.email) LIKE :pattern ESCAPE '!' " +
           "OR LOWER(CONCAT(u.firstName, ' ', u.lastName)) LIKE :pattern ESCAPE '!') " +
           "AND NOT EXISTS (SELECT m.id FROM WorkspaceMember m WHERE m.user = u AND m.workspace.id = :workspaceId) " +
           "ORDER BY u.firstName, u.lastName")
    List<User> searchByNameOrEmailExcludingWorkspace(@Param("pattern") String pattern,
                                                     @Param("workspaceId") Long workspaceId,
                                                     Pageable pageable);

    @Query("SELECT u FROM User u WHERE u.isAdmin = false " +
           "AND NOT EXISTS (SELECT m.id FROM WorkspaceMember m WHERE m.user = u) " +
           "ORDER BY u.createdAt DESC")
    List<User> findAllWithoutWorkspace();
}
