package com.valeo.kanban.repository;

import com.valeo.kanban.model.entity.Task;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;
import org.springframework.stereotype.Repository;
import java.util.Collection;
import java.util.List;
import java.util.Optional;

@Repository
public interface TaskRepository extends JpaRepository<Task, Long> {

    @Query("SELECT t FROM Task t " +
           "JOIN FETCH t.board b " +
           "JOIN FETCH b.workspace w " +
           "JOIN FETCH t.column c " +
           "LEFT JOIN FETCH t.tags " +
           "WHERE t.id = :taskId")
    Optional<Task> findByIdWithHierarchy(@Param("taskId") Long taskId);

    @Query("SELECT DISTINCT t FROM Task t " +
           "LEFT JOIN FETCH t.tags " +
           "LEFT JOIN FETCH t.assignee " +
           "LEFT JOIN FETCH t.createdBy " +
           "WHERE t.board.id = :boardId " +
           "ORDER BY t.position ASC")
    List<Task> findAllByBoardIdOrderByPositionAsc(@Param("boardId") Long boardId);

    long countByColumnId(Long columnId);

    @Query("SELECT t.board.id FROM Task t WHERE t.id = :taskId")
    Optional<Long> findBoardIdById(@Param("taskId") Long taskId);

    // Tasks a user is losing access to; the assignee is fetched for the audit entry
    @Query("SELECT t FROM Task t JOIN FETCH t.assignee WHERE t.assignee.id = :userId AND t.board.id IN :boardIds")
    List<Task> findAllAssignedToUserOnBoards(@Param("userId") Long userId, @Param("boardIds") Collection<Long> boardIds);
}
