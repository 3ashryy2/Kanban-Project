package com.valeo.kanban.repository;

import com.valeo.kanban.model.entity.Workspace;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;
import java.util.Optional;

@Repository
public interface WorkspaceRepository extends JpaRepository<Workspace, Long> {
    Optional<Workspace> findBySlug(String slug);
}
