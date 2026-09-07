package com.valeo.kanban.repository;

import com.valeo.kanban.model.entity.Task;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;
import org.springframework.stereotype.Repository;
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
}
