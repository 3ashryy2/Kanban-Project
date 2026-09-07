package com.valeo.kanban.repository;

import com.valeo.kanban.model.entity.Column;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;
import org.springframework.stereotype.Repository;
import java.util.List;
import java.util.Optional;

@Repository
public interface ColumnRepository extends JpaRepository<Column, Long> {
    List<Column> findAllByBoardIdOrderByPositionAsc(Long boardId);

    @Query("SELECT c FROM Column c WHERE c.id = :columnId AND c.board.id = :boardId")
    Optional<Column> findByIdAndBoardId(@Param("columnId") Long columnId, @Param("boardId") Long boardId);
}
