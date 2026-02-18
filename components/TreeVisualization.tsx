
import React, { useEffect, useRef, useState } from 'react';
import * as d3 from 'd3';
import { FamilyMember, TreeDataNode } from '../types';

interface TreeProps {
  data: FamilyMember[];
  onSelectMember: (id: string) => void;
  rootId?: string;
  focusId?: string | null; 
  direction?: 'horizontal' | 'vertical';
}

// Optimized Hierarchy Builder
const buildHierarchy = (members: FamilyMember[], rootId?: string): TreeDataNode | null => {
  if (!members.length) return null;

  const memberMap = new Map<string, FamilyMember>();
  const childrenMap = new Map<string, FamilyMember[]>();

  members.forEach(m => {
    memberMap.set(m.id, m);
    
    const registerChild = (parentId: string) => {
        if (!childrenMap.has(parentId)) {
            childrenMap.set(parentId, []);
        }
        const siblings = childrenMap.get(parentId)!;
        if (!siblings.some(sib => sib.id === m.id)) {
            siblings.push(m);
        }
    };

    if (m.fatherId) registerChild(m.fatherId);
    if (m.motherId) registerChild(m.motherId);
  });

  const buildNode = (memberId: string): TreeDataNode | null => {
    const member = memberMap.get(memberId);
    if (!member) return null;

    const childrenList = childrenMap.get(memberId) || [];
    
    const uniqueChildren = childrenList
        .map(child => buildNode(child.id))
        .filter((n): n is TreeDataNode => n !== null);

    return {
      name: member.name,
      memberId: member.id,
      attributes: {
        Born: member.birthDate,
        Spouse: member.spouseName,
        Generation: (member as any).generation ?? undefined,
      },
      children: uniqueChildren.length > 0 ? uniqueChildren : undefined,
    };
  };

  if (rootId === 'virtual_root' || !rootId) {
    const topLevelMembers = members.filter(m => {
      const fatherExists = m.fatherId && memberMap.has(m.fatherId) && m.fatherId !== 'virtual_root';
      const motherExists = m.motherId && memberMap.has(m.motherId) && m.motherId !== 'virtual_root';
      return !fatherExists && !motherExists && m.id !== 'virtual_root';
    });

    if (topLevelMembers.length === 0) return null;

    return {
      name: 'Root',
      memberId: 'virtual_root',
      attributes: {},
      children: topLevelMembers.map(m => buildNode(m.id)).filter((n): n is TreeDataNode => n !== null),
    };
  }

  return buildNode(rootId);
};

const TreeVisualization: React.FC<TreeProps> = ({
  data,
  onSelectMember,
  rootId,
  focusId,
  direction = 'horizontal',
}) => {
  const svgRef = useRef<SVGSVGElement>(null);
  const wrapperRef = useRef<HTMLDivElement>(null);
  const [dimensions, setDimensions] = useState({ width: 800, height: 600 });
  
  const lastTransformRef = useRef<d3.ZoomTransform | null>(null);

  useEffect(() => {
    if (!wrapperRef.current) return;
    
    const resizeObserver = new ResizeObserver(entries => {
      for (let entry of entries) {
        setDimensions({
          width: entry.contentRect.width,
          height: entry.contentRect.height
        });
      }
    });

    resizeObserver.observe(wrapperRef.current);
    return () => resizeObserver.disconnect();
  }, []);

  useEffect(() => {
    if (!data.length || !svgRef.current || !wrapperRef.current) return;

    const effectiveRootId = rootId || 'virtual_root';
    const hierarchyData = buildHierarchy(data, effectiveRootId);
    if (!hierarchyData) return;

    const root = d3.hierarchy<TreeDataNode>(hierarchyData);
    const isVertical = direction === 'vertical';

    // Reduced node size since we removed images
    const nodeSize = 60; 
    const levelSize = 160;

    const containerWidth = dimensions.width;
    const containerHeight = dimensions.height;

    const svg = d3.select(svgRef.current);
    svg.selectAll('*').remove();

    svg.attr('width', containerWidth).attr('height', containerHeight);

    // --- defs ---
    const defs = svg.append('defs');

    const shadow = defs
      .append('filter')
      .attr('id', 'node-shadow')
      .attr('x', '-20%')
      .attr('y', '-20%')
      .attr('width', '140%')
      .attr('height', '140%');
    shadow
      .append('feDropShadow')
      .attr('dx', 0)
      .attr('dy', 2)
      .attr('stdDeviation', 2)
      .attr('flood-color', '#000000')
      .attr('flood-opacity', 0.12);

    const linkGradient = defs
      .append('linearGradient')
      .attr('id', 'link-gradient')
      .attr('x1', '0%')
      .attr('y1', '0%')
      .attr('x2', '100%')
      .attr('y2', '0%');
    linkGradient.append('stop').attr('offset', '0%').attr('stop-color', '#7f8f6d'); 
    linkGradient.append('stop').attr('offset', '100%').attr('stop-color', '#c0b29b'); 

    const g = svg.append('g');

    const zoom = d3
      .zoom<SVGSVGElement, unknown>()
      .scaleExtent([0.1, 4])
      .on('zoom', event => {
        g.attr('transform', event.transform);
        lastTransformRef.current = event.transform;
      });

    svg.call(zoom as any);

    const treeLayout = d3
      .tree<TreeDataNode>()
      .nodeSize(isVertical ? [nodeSize, levelSize] : [nodeSize, levelSize])
      .separation((a, b) => (a.parent === b.parent ? 1.2 : 1.5));

    treeLayout(root);

    // ----- Links -----
    g.selectAll('.link')
      .data(root.links())
      .enter()
      .append('path')
      .attr('class', 'link')
      .attr('fill', 'none')
      .attr('stroke', 'url(#link-gradient)')
      .attr('stroke-width', 1.5)
      .attr('stroke-linecap', 'round')
      .attr(
        'd',
        isVertical
          ? d3
              .linkVertical<
                d3.HierarchyPointLink<TreeDataNode>,
                d3.HierarchyPointNode<TreeDataNode>
              >()
              .x(d => d.x)
              .y(d => d.y)
          : d3
              .linkHorizontal<
                d3.HierarchyPointLink<TreeDataNode>,
                d3.HierarchyPointNode<TreeDataNode>
              >()
              .x(d => d.y)
              .y(d => d.x)
      )
      .attr('opacity', d => (d.source.data.memberId === 'virtual_root' ? 0 : 0.8));

    // ----- Nodes -----
    const node = g
      .selectAll('.node')
      .data(root.descendants())
      .enter()
      .append('g')
      .attr('class', 'node cursor-pointer')
      .attr('display', d => (d.data.memberId === 'virtual_root' ? 'none' : 'block'))
      .attr('transform', d =>
        isVertical ? `translate(${d.x},${d.y})` : `translate(${d.y},${d.x})`
      )
      .on('click', (event, d) => onSelectMember(d.data.memberId))
      .on('mouseenter', function () {
        d3.select(this)
          .raise()
          .select('circle.main-circle')
          .transition()
          .duration(150)
          .attr('r', 24);
      })
      .on('mouseleave', function () {
        d3.select(this)
          .select('circle.main-circle')
          .transition()
          .duration(150)
          .attr('r', 20);
      });

    // Add pulsing effect for focused node
    if (focusId) {
         const pulseCircle = node.filter(d => d.data.memberId === focusId)
             .append('circle')
             .attr('r', 30)
             .attr('fill', 'none')
             .attr('stroke', '#c5a059')
             .attr('stroke-width', 2)
             .attr('opacity', 0.6);

         pulseCircle.append('animate')
             .attr('attributeName', 'r')
             .attr('from', '20')
             .attr('to', '40')
             .attr('dur', '1.5s')
             .attr('repeatCount', 'indefinite');

         pulseCircle.append('animate')
             .attr('attributeName', 'opacity')
             .attr('from', '0.6')
             .attr('to', '0')
             .attr('dur', '1.5s')
             .attr('repeatCount', 'indefinite');
    }

    // Main Circle
    node
      .append('circle')
      .attr('class', 'main-circle')
      .attr('r', 20)
      .attr('fill', d => {
        // Simple generation color coding or gender coding
        const gen = d.data.attributes?.Generation as number | undefined;
        if (!gen) return '#f9f5eb';
        const offset = gen % 2;
        return offset === 0 ? '#f9f5eb' : '#fff';
      })
      .attr('stroke', d => (d.data.memberId === focusId ? '#c5a059' : '#2c4f3d'))
      .attr('stroke-width', d => (d.data.memberId === focusId ? 4 : 2))
      .attr('filter', 'url(#node-shadow)');

    // Initials in the circle
    node
        .append('text')
        .attr('dy', 5)
        .attr('text-anchor', 'middle')
        .text(d => d.data.name.charAt(0)) // Show surname or first char
        .style('font-family', '"Noto Serif TC", serif')
        .style('font-weight', 'bold')
        .style('fill', '#2c4f3d')
        .style('font-size', '16px')
        .style('pointer-events', 'none');


    // Name Label
    node
      .append('text')
      .attr('dy', isVertical ? 40 : 5)
      .attr(
        'dx',
        isVertical
          ? 0
          : (d: any) => (d.children && d.children.length > 0 ? -28 : 28)
      )
      .attr(
        'text-anchor',
        isVertical
          ? 'middle'
          : (d: any) => (d.children && d.children.length > 0 ? 'end' : 'start')
      )
      .text(d => d.data.name)
      .style('font-size', '14px')
      .style('font-family', '"Noto Serif TC", serif')
      .style('fill', '#2c4f3d')
      .style('font-weight', 600)
      .style('paint-order', 'stroke')
      .style('stroke', '#fbf7ee')
      .style('stroke-width', 3);

    // Sub-label (Spouse)
    node
      .append('text')
      .attr('dy', isVertical ? 54 : 20)
      .attr(
        'dx',
        isVertical
          ? 0
          : (d: any) => (d.children && d.children.length > 0 ? -28 : 28)
      )
      .attr(
        'text-anchor',
        isVertical
          ? 'middle'
          : (d: any) => (d.children && d.children.length > 0 ? 'end' : 'start')
      )
      .text(d => {
        const spouse = d.data.attributes?.Spouse;
        return spouse ? `配 ${spouse}` : '';
      })
      .style('font-size', '10px')
      .style('font-family', '"Noto Serif TC", serif')
      .style('fill', '#7b7b7b');

    // --- Center & Zoom Logic ---
    let minX = Infinity, maxX = -Infinity, minY = Infinity, maxY = -Infinity;
    root.each(d => {
      if (d.data.memberId === 'virtual_root') return;
      const vx = isVertical ? d.x : d.y;
      const vy = isVertical ? d.y : d.x;
      if (vx < minX) minX = vx;
      if (vx > maxX) maxX = vx;
      if (vy < minY) minY = vy;
      if (vy > maxY) maxY = vy;
    });

    if (!isFinite(minX) || !isFinite(minY)) return;

    let initialTransform = d3.zoomIdentity;
    const focusNode = focusId ? root.descendants().find(d => d.data.memberId === focusId) : null;

    if (focusNode) {
        const fx = isVertical ? focusNode.x : focusNode.y;
        const fy = isVertical ? focusNode.y : focusNode.x;
        const scale = 1.2; 
        initialTransform = d3.zoomIdentity
            .translate(containerWidth / 2, containerHeight / 2)
            .scale(scale)
            .translate(-fx, -fy);
    } else if (lastTransformRef.current && !focusId) { 
        initialTransform = lastTransformRef.current;
    } else {
        const contentWidth = maxX - minX || 1;
        const contentHeight = maxY - minY || 1;
        const padding = 60;
        
        const scaleWidth = (containerWidth - padding * 2) / contentWidth;
        const scaleHeight = (containerHeight - padding * 2) / contentHeight;
        
        // Calculate best fit scale
        let targetScale = Math.min(scaleWidth, scaleHeight);
        
        // Prevent huge nodes on very small trees
        if (targetScale > 1.2) targetScale = 1.2;

        // "Smart Fit": If fitting everything makes it too small (unreadable),
        // enforce a minimum readable scale (0.6) and align to the start (top/left).
        const minReadableScale = 0.6;
        
        if (targetScale < minReadableScale) {
             targetScale = minReadableScale;
             
             if (isVertical) {
                 // Center Horizontally
                 const translateX = (containerWidth - contentWidth * targetScale) / 2 - minX * targetScale;
                 // Align Top (start from minimum Y) with padding
                 const translateY = padding - minY * targetScale;
                 initialTransform = d3.zoomIdentity.translate(translateX, translateY).scale(targetScale);
             } else {
                 // Align Left (start from minimum X) with padding
                 const translateX = padding - minX * targetScale;
                 // Center Vertically
                 const translateY = (containerHeight - contentHeight * targetScale) / 2 - minY * targetScale;
                 initialTransform = d3.zoomIdentity.translate(translateX, translateY).scale(targetScale);
             }
        } else {
             // Standard Center Fit if readable
             const translateX = (containerWidth - contentWidth * targetScale) / 2 - minX * targetScale;
             const translateY = (containerHeight - contentHeight * targetScale) / 2 - minY * targetScale;
             initialTransform = d3.zoomIdentity.translate(translateX, translateY).scale(targetScale);
        }
    }

    if (focusNode) {
        svg.transition().duration(1000).call(zoom.transform as any, initialTransform);
        lastTransformRef.current = initialTransform;
    } else {
        svg.call(zoom.transform as any, initialTransform);
        if (lastTransformRef.current) lastTransformRef.current = initialTransform;
    }

  }, [data, rootId, onSelectMember, direction, dimensions, focusId]);

  return (
    <div
      ref={wrapperRef}
      className="w-full h-full bg-heritage-cream/30 rounded-xl overflow-hidden shadow-inner border border-stone-200 cursor-move relative"
    >
      <svg ref={svgRef} className="block w-full h-full touch-none"></svg>
      <div className="absolute bottom-4 right-4 text-xs text-gray-400 pointer-events-none select-none">
        可拖曳與縮放
      </div>
    </div>
  );
};

export default TreeVisualization;
