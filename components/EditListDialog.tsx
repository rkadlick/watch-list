"use client";

import { useState, useEffect } from "react";
import { Id } from "@/convex/_generated/dataModel";
import { api } from "@/convex/_generated/api";
import { Button } from "./ui/Button";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "./ui/Dialog";
import { Input } from "./ui/Input";
import { Label } from "./ui/Label";
import { Textarea } from "./ui/Textarea";
import { useMutationWithError } from "@/lib/hooks/useMutationWithError";

type EditListDialogProps = {
	listId: Id<"lists">;
	initialName: string;
	initialDescription?: string;
	open: boolean;
	onOpenChange: (open: boolean) => void;
};

export function EditListDialog({
	listId,
	initialName,
	initialDescription = "",
	open,
	onOpenChange,
}: EditListDialogProps) {
	const [name, setName] = useState(initialName);
	const [description, setDescription] = useState(initialDescription);

	// Update local state when initial props change or when dialog opens
	useEffect(() => {
		if (open) {
			setName(initialName);
			setDescription(initialDescription);
		}
	}, [initialName, initialDescription, open]);

	const { mutate: updateList, isPending: isUpdating } = useMutationWithError(
		api.lists.updateList,
		{
			successMessage: "List updated successfully",
		}
	);

	const handleSave = async () => {
		if (!name.trim()) return;

		await updateList({
			listId,
			name,
			description: description || undefined,
		});

		onOpenChange(false);
	};

	return (
		<Dialog open={open} onOpenChange={onOpenChange}>
			<DialogContent className="sm:max-w-[425px]">
				<DialogHeader>
					<DialogTitle>Edit List</DialogTitle>
				</DialogHeader>
				<div className="grid gap-4 py-4">
					<div className="space-y-2">
						<Label htmlFor="name">Name</Label>
						<Input
							id="name"
							value={name}
							onChange={(e) => setName(e.target.value)}
							placeholder="List name"
						/>
					</div>
					<div className="space-y-2">
						<Label htmlFor="description">Description</Label>
						<Textarea
							id="description"
							value={description}
							onChange={(e) => setDescription(e.target.value)}
							placeholder="List description (optional)"
							className="resize-none min-h-[100px]"
						/>
					</div>
				</div>
				<DialogFooter>
					<Button variant="outline" onClick={() => onOpenChange(false)} disabled={isUpdating}>
						Cancel
					</Button>
					<Button onClick={handleSave} disabled={isUpdating}>
						{isUpdating ? "Saving..." : "Save"}
					</Button>
				</DialogFooter>
			</DialogContent>
		</Dialog>
	);
}
