package com.valeo.kanban.repository;

import com.valeo.kanban.model.entity.WorkflowTransition;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;
import org.springframework.stereotype.Repository;
import java.util.List;
import java.util.Optional;

@Repository
public interface WorkflowTransitionRepository extends JpaRepository<WorkflowTransition, Long> {

    Optional<WorkflowTransition> findByBoardIdAndFromColumnIdAndToColumnId(Long boardId, Long fromColumnId, Long toColumnId);

    @Query(value = "SELECT COUNT(wt.id) > 0 FROM workflow_transitions wt WHERE wt.from_column_id = :columnId OR wt.to_column_id = :columnId OR (wt.fallback_column_id IS NOT NULL AND wt.fallback_column_id = :columnId)", nativeQuery = true)
    boolean existsByFromColumnIdOrToColumnIdOrFallbackColumnId(@Param("columnId") Long columnId);

    boolean existsByBoardIdAndToColumnIdAndFallbackColumnId(Long boardId, Long toColumnId, Long fallbackColumnId);

    List<WorkflowTransition> findAllByBoardId(Long boardId);
}
